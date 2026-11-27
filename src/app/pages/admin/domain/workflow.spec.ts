import { buildLedger, summarizeMonth } from './finance';
import type { Agreement, Patient, Payment, Session } from './models';
import { buildFinanceRows, buildWorkflowState } from './workflow';

const perSession: Agreement = {
  type: 'per_session',
  amount: 15000,
  sessionsPerMonth: 4,
  chargeNoShow: true,
};

function makePatient(overrides: Partial<Patient> & { id: string; name: string }): Patient {
  return {
    phone: '11999999999',
    active: true,
    agreement: perSession,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
    calendarTitle: 'Consulta - Ana Paula',
    status: 'done',
    amountApplied: 15000,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
    rescheduledToId: null,
    rescheduledToStartsAt: null,
    statusBeforeReschedule: null,
    rescheduledFromId: null,
    rescheduledFromStartsAt: null,
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> & { id: string }): Payment {
  return {
    patientId: 'p1',
    amount: 15000,
    paidAt: '2026-11-10',
    referenceMonth: '2026-11',
    note: '',
    ...overrides,
  };
}

describe('buildWorkflowState', () => {
  const now = new Date('2026-11-20T15:00:00.000Z');

  it('consultório vazio aponta o passo 1 (Pacientes) como próximo passo', () => {
    const ledger = buildLedger({ patients: [], sessions: [], payments: [] });
    const summary = summarizeMonth(ledger, '2026-11');

    const state = buildWorkflowState({
      patients: [],
      sessions: [],
      summary,
      charges: new Map(),
      month: '2026-11',
      now,
      syncing: false,
      lastSyncedAt: null,
    });

    expect(state.allClear).toBe(false);
    expect(state.nextStep?.id).toBe('patients');
    expect(state.steps[0].status).toBe('pending');
    expect(state.atendimentosBadge).toBe(0);
    expect(state.financeiroBadge).toBe(0);
  });

  it('marca passo 2 como in_progress enquanto agenda sincroniza', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana' });
    const ledger = buildLedger({ patients: [ana], sessions: [], payments: [] });
    const summary = summarizeMonth(ledger, '2026-11');

    const state = buildWorkflowState({
      patients: [ana],
      sessions: [],
      summary,
      charges: new Map(),
      month: '2026-11',
      now,
      syncing: true,
      lastSyncedAt: null,
    });

    expect(state.steps[0].status).toBe('done');
    expect(state.steps[1].status).toBe('in_progress');
    expect(state.nextStep?.id).toBe('sync');
  });

  it('soma sem paciente, pendentes de confirmação e pendências do mês anterior no badge de Atendimentos', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana' });
    const sessions = [
      makeSession({ id: 's-unlinked', patientId: null, status: 'scheduled' }),
      makeSession({ id: 's-pending', patientId: 'p1', status: 'scheduled', startsAt: new Date('2026-11-10T13:00:00.000Z') }),
      makeSession({ id: 's-prev', patientId: 'p1', status: 'scheduled', startsAt: new Date('2026-10-18T13:00:00.000Z') }),
      makeSession({ id: 's-future', patientId: 'p1', status: 'scheduled', startsAt: new Date('2026-11-28T13:00:00.000Z') }),
    ];
    const ledger = buildLedger({ patients: [ana], sessions, payments: [] });
    const summary = summarizeMonth(ledger, '2026-11');

    const state = buildWorkflowState({
      patients: [ana],
      sessions,
      summary,
      charges: new Map(),
      month: '2026-11',
      now,
      syncing: false,
      lastSyncedAt: now,
    });

    expect(state.unidentifiedCount).toBe(1);
    expect(state.pendingConfirmationCount).toBe(1);
    expect(state.previousMonthPendingCount).toBe(1);
    expect(state.previousMonth).toBe('2026-10');
    expect(state.atendimentosBadge).toBe(3);
    expect(state.nextStep?.id).toBe('sessions');
    expect(state.steps[2].route).toBe('/admin/atendimentos');
    expect(state.steps[2].queryParams).toEqual({ aba: 'pendencias' });
  });

  it('mês atual limpo ainda expõe pendência do mês anterior no badge de Atendimentos', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana' });
    const sessions = [
      makeSession({ id: 's-nov', patientId: 'p1', status: 'done', startsAt: new Date('2026-11-05T13:00:00.000Z') }),
      makeSession({ id: 's-oct', patientId: null, status: 'scheduled', startsAt: new Date('2026-10-20T13:00:00.000Z') }),
    ];
    const payments = [makePayment({ id: 'pay-1', patientId: 'p1', amount: 15000, referenceMonth: '2026-11' })];
    const ledger = buildLedger({ patients: [ana], sessions, payments });
    const summary = summarizeMonth(ledger, '2026-11');

    const state = buildWorkflowState({
      patients: [ana],
      sessions,
      summary,
      charges: new Map(),
      month: '2026-11',
      now,
      syncing: false,
      lastSyncedAt: now,
    });

    expect(state.previousMonthPendingCount).toBe(1);
    expect(state.atendimentosBadge).toBe(1);
    expect(state.nextStep?.id).toBe('sessions');
  });

  it('calcula financeiroBadge respeitando cooldown de 7 dias e aponta passo 4', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana' });
    const bia = makePatient({ id: 'p2', name: 'Bia', phone: '11988887777' });
    const sessions = [
      makeSession({ id: 'ana-oct', patientId: 'p1', startsAt: new Date('2026-10-10T13:00:00.000Z') }),
      makeSession({ id: 'ana-nov', patientId: 'p1', startsAt: new Date('2026-11-10T13:00:00.000Z') }),
      makeSession({ id: 'bia-oct', patientId: 'p2', startsAt: new Date('2026-10-12T13:00:00.000Z') }),
      makeSession({ id: 'bia-nov', patientId: 'p2', startsAt: new Date('2026-11-12T13:00:00.000Z') }),
    ];
    const ledger = buildLedger({ patients: [ana, bia], sessions, payments: [] });
    const summary = summarizeMonth(ledger, '2026-11');
    const charges = new Map<string, Date>([['p2', new Date('2026-11-18T12:00:00.000Z')]]);

    const state = buildWorkflowState({
      patients: [ana, bia],
      sessions,
      summary,
      charges,
      month: '2026-11',
      now,
      syncing: false,
      lastSyncedAt: now,
    });

    expect(state.financeiroBadge).toBe(1);
    expect(state.nextStep?.id).toBe('finance');
    expect(state.steps[3].queryParams).toEqual({ aba: 'cobrar' });
  });

  it('marca allClear true quando tudo no mês está concluído e quitado', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana' });
    const sessions = [makeSession({ id: 's1', patientId: 'p1', status: 'done' })];
    const payments = [makePayment({ id: 'pay1', patientId: 'p1', amount: 15000 })];
    const ledger = buildLedger({ patients: [ana], sessions, payments });
    const summary = summarizeMonth(ledger, '2026-11');

    const state = buildWorkflowState({
      patients: [ana],
      sessions,
      summary,
      charges: new Map(),
      month: '2026-11',
      now,
      syncing: false,
      lastSyncedAt: now,
    });

    expect(state.allClear).toBe(true);
    expect(state.nextStep).toBeNull();
    expect(state.atendimentosBadge).toBe(0);
    expect(state.financeiroBadge).toBe(0);
  });
});

describe('buildFinanceRows', () => {
  it('classifica e ordena overdue, open, credit e paid com textos humanos e telefone inválido', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana', phone: '123' }); // overdue + telefone inválido
    const bruno = makePatient({ id: 'p2', name: 'Bruno' }); // open
    const carla = makePatient({ id: 'p3', name: 'Carla' }); // credit
    const davi = makePatient({ id: 'p4', name: 'Davi' }); // paid

    const sessions = [
      makeSession({ id: 'ana-oct', patientId: 'p1', startsAt: new Date('2026-10-05T13:00:00.000Z') }),
      makeSession({ id: 'ana-nov', patientId: 'p1', startsAt: new Date('2026-11-05T13:00:00.000Z') }),
      makeSession({ id: 'bruno-nov', patientId: 'p2', startsAt: new Date('2026-11-06T13:00:00.000Z') }),
      makeSession({ id: 'carla-nov', patientId: 'p3', startsAt: new Date('2026-11-07T13:00:00.000Z') }),
      makeSession({ id: 'davi-nov', patientId: 'p4', startsAt: new Date('2026-11-08T13:00:00.000Z') }),
    ];
    const payments = [
      makePayment({ id: 'pay-c', patientId: 'p3', amount: 30000 }),
      makePayment({ id: 'pay-d', patientId: 'p4', amount: 15000 }),
    ];
    const ledger = buildLedger({ patients: [ana, bruno, carla, davi], sessions, payments });
    const summary = summarizeMonth(ledger, '2026-11');
    const patientsMap = new Map([ana, bruno, carla, davi].map(p => [p.id, p]));

    const rows = buildFinanceRows({ summary, patients: patientsMap, charges: new Map() });

    expect(rows.map(r => [r.name, r.status])).toEqual([
      ['Ana', 'overdue'],
      ['Bruno', 'open'],
      ['Carla', 'credit'],
      ['Davi', 'paid'],
    ]);
    expect(rows[0].chargeUrl).toBeNull();
    expect(rows[0].invalidPhone).toBe(true);
    expect(rows[0].headline).toContain('300,00');
    expect(rows[1].pixPrefill).toEqual({ patientId: 'p2', referenceMonth: '2026-11', amount: '150,00' });
    expect(rows[2].statusLabel).toBe('Com crédito');
    expect(rows[3].statusLabel).toBe('Pago');
  });

  it('classifica como pending_sync quando não há sessões vinculadas no mês (nunca como Pago)', () => {
    const ana = makePatient({ id: 'p1', name: 'Ana' });
    const payments = [makePayment({ id: 'pay-1', patientId: 'p1', amount: 15000 })];
    const ledger = buildLedger({ patients: [ana], sessions: [], payments });
    const summary = summarizeMonth(ledger, '2026-11');

    const rows = buildFinanceRows({
      summary,
      patients: new Map([['p1', ana]]),
      charges: new Map(),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending_sync');
    expect(rows[0].statusLabel).toBe('Aguardando sessões');
    expect(rows[0].chargeUrl).toBeNull();
  });
});
