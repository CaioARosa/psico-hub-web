const BATCH_LIMIT = 400;

function toDate(value) {
  if (value && typeof value.toDate === 'function') return value.toDate();
  return value ?? null;
}

function isCreationShaped(upsert) {
  return upsert.data.calendarEventId !== undefined;
}

// Decide o que gravar para um upsert, dado o doc já existente (ou null).
// Um evento movido de mês gera upsert de criação para um id que pode já existir.
function resolveUpsertWrite(upsert, existingData) {
  if (!isCreationShaped(upsert)) {
    return { action: 'set', data: upsert.data, merge: true };
  }
  if (!existingData) {
    return { action: 'set', data: upsert.data, merge: false };
  }
  if (existingData.status !== 'scheduled') {
    return { action: 'skip' };
  }
  const { startsAt, calendarTitle } = upsert.data;
  return {
    action: 'set',
    data: { startsAt, calendarTitle, missingFromCalendar: false },
    merge: true,
  };
}

const RESCHEDULABLE_STATUSES = new Set(['scheduled', 'no_show', 'cancelled']);

// Revalida a original dentro da transação: outra aba pode tê-la concluído/reagendado no meio.
function planRescheduleCommit(existingData, { originalId, newId, newData, originalUpdate }) {
  if (!existingData || !RESCHEDULABLE_STATUSES.has(existingData.status)) {
    throw Object.assign(new Error('Sessão não pode mais ser reagendada.'), { code: 'NOT_RESCHEDULABLE' });
  }
  return {
    writes: [
      { action: 'set', id: newId, data: newData },
      { action: 'update', id: originalId, data: { ...originalUpdate, statusBeforeReschedule: existingData.status } },
    ],
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function commitInBatches(db, items, apply) {
  for (const group of chunk(items, BATCH_LIMIT)) {
    const batch = db.batch();
    for (const item of group) apply(batch, item);
    await batch.commit();
  }
}

function createFirestoreRepo(db) {
  const sessions = () => db.collection('sessions');

  return {
    async listPatients() {
      const snapshot = await db.collection('patients').get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async listSessionsBetween(start, end) {
      const snapshot = await sessions().where('startsAt', '>=', start).where('startsAt', '<', end).get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, startsAt: toDate(data.startsAt) };
      });
    },

    async getSession(id) {
      const snap = await sessions().doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data();
      return { id: snap.id, ...data, startsAt: toDate(data.startsAt) };
    },

    async commitReschedule(args) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(sessions().doc(args.originalId));
        const { writes } = planRescheduleCommit(snap.exists ? snap.data() : null, args);
        for (const { action, id, data } of writes) {
          if (action === 'set') tx.set(sessions().doc(id), data);
          else tx.update(sessions().doc(id), data);
        }
      });
    },

    async applyUpserts(upserts) {
      const refs = new Map(upserts.map((u) => [u.id, sessions().doc(u.id)]));
      const creations = upserts.filter(isCreationShaped);
      const existing = new Map();
      for (const group of chunk(creations, BATCH_LIMIT)) {
        const snaps = await db.getAll(...group.map((u) => refs.get(u.id)));
        snaps.forEach((snap, i) => existing.set(group[i].id, snap.exists ? snap.data() : null));
      }

      const writes = [];
      for (const upsert of upserts) {
        const result = resolveUpsertWrite(upsert, existing.get(upsert.id) ?? null);
        if (result.action === 'skip') continue;
        writes.push({ ref: refs.get(upsert.id), data: result.data, merge: result.merge });
      }

      await commitInBatches(db, writes, (batch, { ref, data, merge }) => {
        if (merge) batch.set(ref, data, { merge: true });
        else batch.set(ref, data);
      });
    },

    async applyDeletes(ids) {
      await commitInBatches(db, ids, (batch, id) => {
        batch.delete(sessions().doc(id));
      });
    },

    async recordSync(month, syncedAt) {
      await db.collection('calendarSyncs').doc(month).set({ month, syncedAt });
    },
  };
}

module.exports = { createFirestoreRepo, resolveUpsertWrite, planRescheduleCommit, toDate, RESCHEDULABLE_STATUSES };
