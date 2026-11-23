const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rescheduleSession } = require('./reschedule');
const { SESSION_REMINDERS } = require('./booking-event');

const originalStartsAt = new Date('2026-11-23T22:00:00Z');
const baseSession = () => ({
  id: 'old1',
  patientId: 'p1',
  startsAt: originalStartsAt,
  status: 'scheduled',
  amountApplied: 15000,
  packageAmountApplied: 0,
  chargeNoShowApplied: null,
  calendarTitle: 'Psicoterapia Ana (agenda)',
  calendarEventId: 'old1',
  missingFromCalendar: false,
});
const originalEvent = {
  id: 'old1',
  summary: 'Psicoterapia Ana',
  description: 'd',
  reminders: { useDefault: true },
  start: { dateTime: '2026-11-23T22:00:00Z' },
  end: { dateTime: '2026-11-23T22:50:00Z' },
};

function fakes({ session = baseSession(), getEvent, listItems = [], commit, deleteOld } = {}) {
  const calls = { get: [], list: [], insert: [], delete: [], commit: [] };
  const calendar = {
    events: {
      get: async (params) => {
        calls.get.push(params);
        if (getEvent) return getEvent();
        return { data: originalEvent };
      },
      list: async (params) => {
        calls.list.push(params);
        return { data: { items: listItems } };
      },
      insert: async (params) => {
        calls.insert.push(params);
        return { data: { id: 'new1', ...params.requestBody } };
      },
      delete: async (params) => {
        calls.delete.push(params);
        if (params.eventId === 'old1' && deleteOld) return deleteOld();
        return {};
      },
    },
  };
  const repo = {
    getSession: async (id) => (session && session.id === id ? session : null),
    commitReschedule: async (args) => {
      calls.commit.push(args);
      if (commit) return commit();
    },
  };
  return { calendar, repo, calls };
}

const run = (overrides = {}, fakeOptions = {}) => {
  const f = fakes(fakeOptions);
  const promise = rescheduleSession({
    sessionId: 'old1',
    startsAt: '2026-11-26T20:00:00-03:00',
    force: false,
    calendar: f.calendar,
    calendarId: 'cal',
    repo: f.repo,
    ...overrides,
  });
  return promise.then((result) => ({ result, calls: f.calls }));
};

test('503 quando o Google Agenda não está configurado', async () => {
  const { result } = await run({ calendar: null });
  assert.deepEqual(result, { status: 503, body: { error: 'Google Agenda não configurado.' } });
});

for (const startsAt of [undefined, '', 'amanhã', 123]) {
  test(`400 para startsAt inválido (${String(startsAt)})`, async () => {
    const { result, calls } = await run({ startsAt });
    assert.deepEqual(result, { status: 400, body: { error: 'Data/hora inválida.' } });
    assert.equal(calls.insert.length, 0);
  });
}

test('404 quando a sessão não existe', async () => {
  const { result } = await run({}, { session: null });
  assert.deepEqual(result, { status: 404, body: { error: 'Sessão não encontrada.' } });
});

test('404 para id de sessão com caracteres inválidos', async () => {
  const { result, calls } = await run({ sessionId: 'a/b' });
  assert.deepEqual(result, { status: 404, body: { error: 'Sessão não encontrada.' } });
  assert.equal(calls.get.length, 0);
});

test('422 quando a sessão não tem paciente', async () => {
  const { result } = await run({}, { session: { ...baseSession(), patientId: null } });
  assert.deepEqual(result, { status: 422, body: { error: 'Vincule um paciente antes de reagendar.' } });
});

for (const status of ['done', 'rescheduled']) {
  test(`409 quando a sessão está ${status}`, async () => {
    const { result, calls } = await run({}, { session: { ...baseSession(), status } });
    assert.deepEqual(result, { status: 409, body: { error: 'Esta sessão não pode ser reagendada.' } });
    assert.equal(calls.get.length, 0);
  });
}

test('400 quando startsAt é igual ao atual', async () => {
  const { result } = await run({ startsAt: '2026-11-23T19:00:00-03:00' });
  assert.deepEqual(result, { status: 400, body: { error: 'Escolha uma data/hora diferente da atual.' } });
});

test('sucesso: cria evento novo, grava a transação e apaga o antigo', async () => {
  const { result, calls } = await run({}, { session: { ...baseSession(), status: 'no_show' } });
  assert.deepEqual(result, {
    status: 200,
    body: { newSessionId: 'new1', startsAt: '2026-11-26T23:00:00.000Z' },
  });

  assert.deepEqual(calls.get, [{ calendarId: 'cal', eventId: 'old1' }]);
  assert.deepEqual(calls.list, [
    {
      calendarId: 'cal',
      timeMin: '2026-11-26T23:00:00.000Z',
      timeMax: '2026-11-26T23:50:00.000Z',
      singleEvents: true,
    },
  ]);
  assert.deepEqual(calls.insert, [
    {
      calendarId: 'cal',
      requestBody: {
        summary: 'Psicoterapia Ana',
        description: 'd',
        reminders: { useDefault: true },
        start: { dateTime: '2026-11-26T23:00:00.000Z', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-11-26T23:50:00.000Z', timeZone: 'America/Sao_Paulo' },
      },
    },
  ]);

  const newStart = new Date('2026-11-26T23:00:00.000Z');
  assert.deepEqual(calls.commit, [
    {
      originalId: 'old1',
      newId: 'new1',
      newData: {
        patientId: 'p1',
        calendarEventId: 'new1',
        startsAt: newStart,
        calendarTitle: 'Psicoterapia Ana (agenda)',
        status: 'scheduled',
        amountApplied: 15000,
        packageAmountApplied: 0,
        chargeNoShowApplied: null,
        missingFromCalendar: false,
        rescheduledFromId: 'old1',
        rescheduledFromStartsAt: originalStartsAt,
      },
      originalUpdate: {
        status: 'rescheduled',
        rescheduledToId: 'new1',
        rescheduledToStartsAt: newStart,
      },
    },
  ]);
  assert.deepEqual(calls.delete, [{ calendarId: 'cal', eventId: 'old1' }]);
});

for (const error of [{ code: 404 }, { response: { status: 410 } }]) {
  test(`evento original ausente (${JSON.stringify(error)}) usa calendarTitle, 50 min e lembretes padrão`, async () => {
    const { result, calls } = await run({}, { getEvent: () => Promise.reject(error) });
    assert.equal(result.status, 200);
    assert.deepEqual(calls.insert[0].requestBody, {
      summary: 'Psicoterapia Ana (agenda)',
      reminders: SESSION_REMINDERS,
      start: { dateTime: '2026-11-26T23:00:00.000Z', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-11-26T23:50:00.000Z', timeZone: 'America/Sao_Paulo' },
    });
  });
}

test('campos ausentes na sessão original viram null na nova', async () => {
  const { packageAmountApplied, ...session } = baseSession();
  const { result, calls } = await run({}, { session });
  assert.equal(result.status, 200);
  assert.equal(calls.commit[0].newData.packageAmountApplied, null);
});

test('erro inesperado ao ler o evento original vira 500 sem gravar', async () => {
  const { result, calls } = await run({}, { getEvent: () => Promise.reject({ code: 500 }) });
  assert.deepEqual(result, { status: 500, body: { error: 'Falha ao reagendar. Tente novamente.' } });
  assert.equal(calls.insert.length, 0);
  assert.equal(calls.commit.length, 0);
});

const conflictItems = [
  { id: 'old1', start: { dateTime: '2026-11-26T23:00:00Z' }, end: { dateTime: '2026-11-26T23:50:00Z' } },
  { id: 'c1', status: 'cancelled', start: { dateTime: '2026-11-26T23:00:00Z' }, end: { dateTime: '2026-11-26T23:50:00Z' } },
  { id: 'a1', summary: 'Feriado', start: { date: '2026-11-26' }, end: { date: '2026-11-27' } },
  {
    id: 'b1',
    summary: 'Psicoterapia Bruno',
    start: { dateTime: '2026-11-26T20:30:00-03:00' },
    end: { dateTime: '2026-11-26T21:20:00-03:00' },
  },
];

test('409 com conflitos reais (ignora o próprio evento, cancelados e dia inteiro)', async () => {
  const { result, calls } = await run({}, { listItems: conflictItems });
  assert.deepEqual(result, {
    status: 409,
    body: {
      error: 'Já existe compromisso nesse horário.',
      conflicts: [
        { title: 'Psicoterapia Bruno', startsAt: '2026-11-26T23:30:00.000Z', endsAt: '2026-11-27T00:20:00.000Z' },
      ],
    },
  });
  assert.equal(calls.insert.length, 0);
  assert.equal(calls.commit.length, 0);
});

test('force: true reagenda mesmo com conflito', async () => {
  const { result, calls } = await run({ force: true }, { listItems: conflictItems });
  assert.equal(result.status, 200);
  assert.equal(calls.insert.length, 1);
});

test('falha na transação apaga o evento novo e devolve 500', async () => {
  const { result, calls } = await run({}, { commit: () => Promise.reject(new Error('boom')) });
  assert.deepEqual(result, { status: 500, body: { error: 'Falha ao reagendar. Tente novamente.' } });
  assert.deepEqual(calls.delete, [{ calendarId: 'cal', eventId: 'new1' }]);
});

test('NOT_RESCHEDULABLE na transação apaga o evento novo e devolve 409', async () => {
  const error = Object.assign(new Error('nope'), { code: 'NOT_RESCHEDULABLE' });
  const { result, calls } = await run({}, { commit: () => Promise.reject(error) });
  assert.deepEqual(result, { status: 409, body: { error: 'Esta sessão não pode ser reagendada.' } });
  assert.deepEqual(calls.delete, [{ calendarId: 'cal', eventId: 'new1' }]);
});

test('falha ao apagar o evento antigo não impede o sucesso', async () => {
  const { result } = await run({}, { deleteOld: () => Promise.reject({ code: 500 }) });
  assert.equal(result.status, 200);
});
