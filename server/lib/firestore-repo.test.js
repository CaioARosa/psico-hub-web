const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveUpsertWrite, toDate, createFirestoreRepo } = require('./firestore-repo');

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
        set: (ref, data, options) => ops.push({ id: ref.id, data, options }),
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
