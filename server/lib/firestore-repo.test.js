const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveUpsertWrite, planRescheduleCommit, toDate, createFirestoreRepo } = require('./firestore-repo');

const startsAt = new Date('2026-11-10T13:00:00Z');
const createUpsert = {
  id: 'evt1',
  data: {
    patientId: 'p1',
    calendarEventId: 'evt1',
    startsAt,
    calendarTitle: 'Consulta - Ana',
    status: 'scheduled',
    amountApplied: 15000,
    missingFromCalendar: false,
  },
};

test('toDate converte Timestamp-like para Date e mantém Date', () => {
  const date = new Date('2026-11-10T13:00:00Z');
  assert.equal(toDate({ toDate: () => date }), date);
  assert.equal(toDate(date), date);
  assert.equal(toDate(null), null);
});

test('criação: sem doc existente grava os dados completos', () => {
  const result = resolveUpsertWrite(createUpsert, null);
  assert.equal(result.action, 'set');
  assert.deepEqual(result.data, createUpsert.data);
  assert.equal(result.merge, false);
});

for (const status of ['done', 'no_show', 'cancelled']) {
  test(`criação: pula quando o doc existente está ${status}`, () => {
    assert.deepEqual(resolveUpsertWrite(createUpsert, { status }), { action: 'skip' });
  });
}

test('criação: doc existente scheduled recebe só startsAt, calendarTitle e missingFromCalendar=false', () => {
  const result = resolveUpsertWrite(createUpsert, {
    status: 'scheduled',
    patientId: 'p9',
    amountApplied: 999,
    missingFromCalendar: true,
  });
  assert.equal(result.action, 'set');
  assert.equal(result.merge, true);
  assert.deepEqual(result.data, {
    startsAt,
    calendarTitle: 'Consulta - Ana',
    missingFromCalendar: false,
  });
});

test('atualização (sem calendarEventId) passa direto com merge', () => {
  const upsert = { id: 'evt2', data: { missingFromCalendar: true } };
  const result = resolveUpsertWrite(upsert, { status: 'done' });
  assert.deepEqual(result, { action: 'set', data: { missingFromCalendar: true }, merge: true });
});

function fakeDb(initialDocs = {}) {
  const docs = new Map(Object.entries(initialDocs));
  const commits = [];
  const getAllCalls = [];
  const sets = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        path: `${name}/${id}`,
        id,
        set: async (data) => sets.push({ path: `${name}/${id}`, data }),
      }),
    }),
    getAll: async (...refs) => {
      getAllCalls.push(refs.length);
      return refs.map((ref) => ({
        exists: docs.has(ref.id),
        data: () => docs.get(ref.id),
      }));
    },
    batch: () => {
      const ops = [];
      return {
        set: (ref, data, options) => ops.push({ op: 'set', id: ref.id, data, options }),
        delete: (ref) => ops.push({ op: 'delete', id: ref.id }),
        commit: async () => commits.push(ops),
      };
    },
  };
  return { db, commits, getAllCalls, sets };
}

test('recordSync grava calendarSyncs/{mês} com o mês e a hora', async () => {
  const { db, sets } = fakeDb();
  const syncedAt = new Date('2026-11-18T00:30:00Z');
  await createFirestoreRepo(db).recordSync('2026-11', syncedAt);
  assert.deepEqual(sets, [{ path: 'calendarSyncs/2026-11', data: { month: '2026-11', syncedAt } }]);
});

test('applyUpserts: lê docs de criação com getAll, pula terminais, cria ausentes, mescla scheduled', async () => {
  const { db, commits } = fakeDb({
    done1: { status: 'done' },
    sched1: { status: 'scheduled' },
  });
  const repo = createFirestoreRepo(db);
  const mk = (id) => ({ id, data: { ...createUpsert.data, calendarEventId: id } });
  await repo.applyUpserts([
    mk('done1'),
    mk('sched1'),
    mk('new1'),
    { id: 'upd1', data: { missingFromCalendar: true } },
  ]);
  const ops = commits.flat();
  assert.deepEqual(ops.map((o) => o.id).sort(), ['new1', 'sched1', 'upd1']);
  const byId = Object.fromEntries(ops.map((o) => [o.id, o]));
  assert.equal(byId.new1.data.status, 'scheduled');
  assert.deepEqual(Object.keys(byId.sched1.data).sort(), ['calendarTitle', 'missingFromCalendar', 'startsAt']);
  assert.deepEqual(byId.upd1.options, { merge: true });
});

test('applyUpserts: escreve em lotes de até 400', async () => {
  const { db, commits } = fakeDb();
  const repo = createFirestoreRepo(db);
  const upserts = Array.from({ length: 950 }, (_, i) => ({ id: `u${i}`, data: { missingFromCalendar: true } }));
  await repo.applyUpserts(upserts);
  assert.deepEqual(commits.map((c) => c.length), [400, 400, 150]);
});

const rescheduleArgs = {
  originalId: 'old1',
  newId: 'new1',
  newData: { status: 'scheduled', startsAt },
  originalUpdate: { status: 'rescheduled', rescheduledToId: 'new1' },
};

for (const status of ['scheduled', 'no_show', 'cancelled']) {
  test(`planRescheduleCommit: original ${status} cria a nova e atualiza a original`, () => {
    assert.deepEqual(planRescheduleCommit({ status }, rescheduleArgs), {
      writes: [
        { action: 'set', id: 'new1', data: rescheduleArgs.newData },
        { action: 'update', id: 'old1', data: { ...rescheduleArgs.originalUpdate, statusBeforeReschedule: status } },
      ],
    });
  });
}

test('planRescheduleCommit: statusBeforeReschedule vem do status lido na transação', () => {
  const args = {
    ...rescheduleArgs,
    originalUpdate: { ...rescheduleArgs.originalUpdate, statusBeforeReschedule: 'scheduled' },
  };
  const { writes } = planRescheduleCommit({ status: 'no_show' }, args);
  assert.equal(writes[1].data.statusBeforeReschedule, 'no_show');
});

for (const existing of [null, { status: 'done' }, { status: 'rescheduled' }]) {
  test(`planRescheduleCommit: lança NOT_RESCHEDULABLE para ${JSON.stringify(existing)}`, () => {
    assert.throws(() => planRescheduleCommit(existing, rescheduleArgs), { code: 'NOT_RESCHEDULABLE' });
  });
}

function fakeTransactionDb(docs) {
  const writes = [];
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}`, id }) }),
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({ exists: ref.id in docs, data: () => docs[ref.id] }),
        set: (ref, data) => writes.push({ op: 'set', path: ref.path, data }),
        update: (ref, data) => writes.push({ op: 'update', path: ref.path, data }),
      }),
  };
  return { db, writes };
}

test('commitReschedule: original done lança NOT_RESCHEDULABLE e não grava nada', async () => {
  const { db, writes } = fakeTransactionDb({ old1: { status: 'done' } });
  await assert.rejects(createFirestoreRepo(db).commitReschedule(rescheduleArgs), { code: 'NOT_RESCHEDULABLE' });
  assert.deepEqual(writes, []);
});

test('commitReschedule: grava a nova sessão e atualiza a original na transação', async () => {
  const { db, writes } = fakeTransactionDb({ old1: { status: 'scheduled' } });
  await createFirestoreRepo(db).commitReschedule(rescheduleArgs);
  assert.deepEqual(writes, [
    { op: 'set', path: 'sessions/new1', data: rescheduleArgs.newData },
    {
      op: 'update',
      path: 'sessions/old1',
      data: { ...rescheduleArgs.originalUpdate, statusBeforeReschedule: 'scheduled' },
    },
  ]);
});

test('getSession converte startsAt e devolve null quando não existe', async () => {
  const date = new Date('2026-11-10T13:00:00Z');
  const db = {
    collection: () => ({
      doc: (id) => ({
        get: async () =>
          id === 's1'
            ? { exists: true, id, data: () => ({ status: 'scheduled', startsAt: { toDate: () => date } }) }
            : { exists: false, id },
      }),
    }),
  };
  const repo = createFirestoreRepo(db);
  assert.deepEqual(await repo.getSession('s1'), { id: 's1', status: 'scheduled', startsAt: date });
  assert.equal(await repo.getSession('nope'), null);
});

test('applyDeletes: remove documentos em lotes de até 400', async () => {
  const { db, commits } = fakeDb();
  const repo = createFirestoreRepo(db);
  const ids = Array.from({ length: 450 }, (_, i) => `d${i}`);
  await repo.applyDeletes(ids);
  assert.deepEqual(commits.map((c) => c.length), [400, 50]);
  assert.deepEqual(commits[0][0], { op: 'delete', id: 'd0' });
});
