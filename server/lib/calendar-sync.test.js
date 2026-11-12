const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monthWindow, planSessionSync, syncMonth } = require('./calendar-sync');

const window = monthWindow('2026-11');

const perSession = { type: 'per_session', amount: 15000 };
const monthly = { type: 'monthly_package', amount: 60000, sessionsPerMonth: 4 };
const patient = (id, name, agreement = perSession, active = true) => ({ id, name, active, agreement });
const event = (id, summary, dateTime, extra = {}) => ({ id, summary, start: { dateTime }, ...extra });
const session = (id, extra = {}) => ({
  id,
  patientId: 'p1',
  status: 'scheduled',
  startsAt: new Date('2026-11-10T13:00:00Z'),
  missingFromCalendar: false,
  ...extra,
});
const plan = (args) => planSessionSync({ events: [], patients: [], existingSessions: [], window, ...args });

test('monthWindow usa o dia 1 às 00:00 em UTC-3', () => {
  const w = monthWindow('2026-11');
  assert.equal(w.start.toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(w.end.toISOString(), '2026-12-01T03:00:00.000Z');
});

test('monthWindow vira o ano em dezembro', () => {
  const w = monthWindow('2026-12');
  assert.equal(w.start.toISOString(), '2026-12-01T03:00:00.000Z');
  assert.equal(w.end.toISOString(), '2027-01-01T03:00:00.000Z');
});

test('monthWindow lança para mês inválido', () => {
  assert.throws(() => monthWindow('2026-13'), { message: 'Mês inválido. Formato esperado: YYYY-MM.' });
  assert.throws(() => monthWindow('2026-00'), /Mês inválido/);
  assert.throws(() => monthWindow('novembro'), /Mês inválido/);
  assert.throws(() => monthWindow(undefined), /Mês inválido/);
});

test('cria sessão para evento que casa (per_session)', () => {
  const result = plan({
    events: [event('e1', 'Consulta [Individual] - Maria Souza', '2026-11-10T13:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza')],
  });
  assert.deepEqual(result.upserts, [
    {
      id: 'e1',
      data: {
        patientId: 'p1',
        calendarEventId: 'e1',
        startsAt: new Date('2026-11-10T16:00:00Z'),
        calendarTitle: 'Consulta [Individual] - Maria Souza',
        status: 'scheduled',
        amountApplied: 15000,
        missingFromCalendar: false,
      },
    },
  ]);
  assert.deepEqual(result.summary, { created: 1, updated: 0, unidentified: 0, missing: 0 });
});

test('cria sessão com valor 0 em monthly_package', () => {
  const result = plan({
    events: [event('e1', 'Consulta - Maria Souza', '2026-11-10T13:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza', monthly)],
  });
  assert.equal(result.upserts[0].data.amountApplied, 0);
});

test('evento sem paciente vira patientId null e conta em unidentified', () => {
  const result = plan({
    events: [event('e1', 'Reunião qualquer', '2026-11-10T13:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza')],
  });
  assert.equal(result.upserts[0].data.patientId, null);
  assert.equal(result.upserts[0].data.amountApplied, 0);
  assert.deepEqual(result.summary, { created: 1, updated: 0, unidentified: 1, missing: 0 });
});

test('ignora evento de dia inteiro', () => {
  const result = plan({
    events: [{ id: 'e1', summary: 'Feriado', start: { date: '2026-11-10' } }],
    patients: [patient('p1', 'Maria Souza')],
  });
  assert.deepEqual(result.upserts, []);
  assert.deepEqual(result.summary, { created: 0, updated: 0, unidentified: 0, missing: 0 });
});

test('ignora evento cancelado', () => {
  const result = plan({
    events: [event('e1', 'Consulta - Maria Souza', '2026-11-10T13:00:00-03:00', { status: 'cancelled' })],
    patients: [patient('p1', 'Maria Souza')],
  });
  assert.deepEqual(result.upserts, []);
});

test('evento em 2026-12-01T01:00:00Z entra em novembro', () => {
  const result = plan({
    events: [event('e1', 'Consulta - Maria Souza', '2026-12-01T01:00:00Z')],
    patients: [patient('p1', 'Maria Souza')],
  });
  assert.equal(result.upserts.length, 1);
  assert.equal(result.summary.created, 1);
});

test('evento em 2026-12-01T04:00:00Z fica de fora', () => {
  const result = plan({
    events: [event('e1', 'Consulta - Maria Souza', '2026-12-01T04:00:00Z')],
    patients: [patient('p1', 'Maria Souza')],
  });
  assert.deepEqual(result.upserts, []);
  assert.equal(result.summary.created, 0);
});

test('sessão existente scheduled atualiza horário e título e preserva patientId e amountApplied', () => {
  const result = plan({
    events: [event('s1', 'Consulta - Maria Souza (remarcada)', '2026-11-12T14:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza', { type: 'per_session', amount: 99900 })],
    existingSessions: [session('s1', { amountApplied: 15000 })],
  });
  assert.deepEqual(result.upserts, [
    {
      id: 's1',
      data: {
        startsAt: new Date('2026-11-12T17:00:00Z'),
        calendarTitle: 'Consulta - Maria Souza (remarcada)',
        missingFromCalendar: false,
      },
    },
  ]);
  assert.deepEqual(result.summary, { created: 0, updated: 1, unidentified: 0, missing: 0 });
});

test('sessão scheduled que reapareceu no Agenda limpa missingFromCalendar', () => {
  const result = plan({
    events: [event('s1', 'Consulta - Maria Souza', '2026-11-10T10:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza')],
    existingSessions: [session('s1', { missingFromCalendar: true })],
  });
  assert.equal(result.upserts[0].data.missingFromCalendar, false);
  assert.equal(result.summary.missing, 0);
});

test('não altera sessão done, no_show ou cancelled', () => {
  const existingSessions = ['done', 'no_show', 'cancelled'].map((status) => session(`s-${status}`, { status }));
  const result = plan({
    events: existingSessions.map((s) => event(s.id, 'Consulta - Maria Souza', '2026-11-20T09:00:00-03:00')),
    patients: [patient('p1', 'Maria Souza')],
    existingSessions,
  });
  assert.deepEqual(result.upserts, []);
  assert.deepEqual(result.summary, { created: 0, updated: 0, unidentified: 0, missing: 0 });
});

test('sessão scheduled sem paciente tenta vincular de novo', () => {
  const result = plan({
    events: [event('s1', 'Consulta - Maria Souza', '2026-11-10T10:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza')],
    existingSessions: [session('s1', { patientId: null, amountApplied: null })],
  });
  assert.deepEqual(result.upserts[0].data, {
    startsAt: new Date('2026-11-10T13:00:00Z'),
    calendarTitle: 'Consulta - Maria Souza',
    missingFromCalendar: false,
    patientId: 'p1',
    amountApplied: 15000,
  });
  assert.deepEqual(result.summary, { created: 0, updated: 1, unidentified: 0, missing: 0 });
});

test('sessão scheduled sem paciente que continua sem casar conta em unidentified', () => {
  const result = plan({
    events: [event('s1', 'Reunião', '2026-11-10T10:00:00-03:00')],
    patients: [patient('p1', 'Maria Souza')],
    existingSessions: [session('s1', { patientId: null, amountApplied: null })],
  });
  assert.equal('patientId' in result.upserts[0].data, false);
  assert.equal('amountApplied' in result.upserts[0].data, false);
  assert.deepEqual(result.summary, { created: 0, updated: 1, unidentified: 1, missing: 0 });
});

test('sessão scheduled ausente do Agenda recebe missingFromCalendar true', () => {
  const result = plan({ existingSessions: [session('s1')] });
  assert.deepEqual(result.upserts, [{ id: 's1', data: { missingFromCalendar: true } }]);
  assert.deepEqual(result.summary, { created: 0, updated: 0, unidentified: 0, missing: 1 });
});

test('sessão done ausente do Agenda não recebe missingFromCalendar', () => {
  const result = plan({ existingSessions: [session('s1', { status: 'done' })] });
  assert.deepEqual(result.upserts, []);
  assert.equal(result.summary.missing, 0);
});

test('evento cancelado no Agenda deixa a sessão scheduled como ausente', () => {
  const result = plan({
    events: [event('s1', 'Consulta - Maria Souza', '2026-11-10T10:00:00-03:00', { status: 'cancelled' })],
    patients: [patient('p1', 'Maria Souza')],
    existingSessions: [session('s1')],
  });
  assert.deepEqual(result.upserts, [{ id: 's1', data: { missingFromCalendar: true } }]);
});

test('rodar duas vezes seguidas com as sessões resultantes não gera novos created', () => {
  const events = [
    event('e1', 'Consulta - Maria Souza', '2026-11-10T10:00:00-03:00'),
    event('e2', 'Sem nome', '2026-11-11T10:00:00-03:00'),
  ];
  const patients = [patient('p1', 'Maria Souza')];
  const first = planSessionSync({ events, patients, existingSessions: [], window });
  assert.equal(first.summary.created, 2);

  const existingSessions = first.upserts.map((u) => ({ id: u.id, missingFromCalendar: false, ...u.data }));
  const second = planSessionSync({ events, patients, existingSessions, window });
  assert.equal(second.summary.created, 0);
  assert.equal(second.summary.updated, 2);
  assert.equal(second.summary.unidentified, 1);
  assert.ok(second.upserts.every((u) => !('calendarEventId' in u.data)));
});

const makeFakes = ({ events = [], sessions = [], calendarError = null } = {}) => {
  const calls = { list: [], applied: [], sessionsRange: [] };
  const calendar = {
    events: {
      list: async (params) => {
        calls.list.push(params);
        if (calendarError) throw calendarError;
        return { data: { items: events } };
      },
    },
  };
  const repo = {
    listPatients: async () => [patient('p1', 'Maria Souza')],
    listSessionsBetween: async (start, end) => {
      calls.sessionsRange.push([start, end]);
      return sessions;
    },
    applyUpserts: async (upserts) => {
      calls.applied.push(upserts);
    },
  };
  return { calls, calendar, repo };
};

test('syncMonth chama o Agenda com a janela do mês, passa pacientes e sessões ao planejamento e aplica os upserts', async () => {
  const { calls, calendar, repo } = makeFakes({
    events: [
      event('e1', 'Consulta - Maria Souza', '2026-11-10T13:00:00-03:00'),
      event('e2', 'Consulta - Maria Souza', '2026-11-11T13:00:00-03:00'),
      event('e3', 'Consulta - Maria Souza', '2026-11-12T13:00:00-03:00'),
    ],
    sessions: [session('e2', { status: 'done' }), session('e3')],
  });
  const summary = await syncMonth({ month: '2026-11', calendar, calendarId: 'cal-id', repo });

  assert.deepEqual(calls.list, [
    {
      calendarId: 'cal-id',
      timeMin: '2026-11-01T03:00:00.000Z',
      timeMax: '2026-12-01T03:00:00.000Z',
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    },
  ]);
  assert.equal(calls.sessionsRange.length, 1);
  const [rangeStart, rangeEnd] = calls.sessionsRange[0];
  assert.ok(rangeStart instanceof Date && rangeEnd instanceof Date);
  assert.equal(rangeStart.toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(rangeEnd.toISOString(), '2026-12-01T03:00:00.000Z');

  assert.equal(calls.applied.length, 1);
  const upserts = calls.applied[0];
  assert.deepEqual(upserts.map((u) => u.id), ['e1', 'e3']);
  assert.equal(upserts[0].data.patientId, 'p1');
  assert.equal(upserts[0].data.calendarEventId, 'e1');
  assert.equal('calendarEventId' in upserts[1].data, false);
  assert.deepEqual(summary, { created: 1, updated: 1, unidentified: 0, missing: 0 });
});

test('syncMonth propaga erro do Agenda sem chamar applyUpserts', async () => {
  const { calls, calendar, repo } = makeFakes({ calendarError: new Error('Agenda fora do ar') });
  await assert.rejects(syncMonth({ month: '2026-11', calendar, calendarId: 'cal-id', repo }), {
    message: 'Agenda fora do ar',
  });
  assert.equal(calls.applied.length, 0);
});

test('syncMonth rejeita mês inválido sem chamar o Agenda', async () => {
  const { calls, calendar, repo } = makeFakes();
  await assert.rejects(syncMonth({ month: '2026-13', calendar, calendarId: 'cal-id', repo }), /Mês inválido/);
  assert.equal(calls.list.length, 0);
});
