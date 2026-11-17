import { buildDashboard } from './dashboard';
import { buildLedger, summarizeMonth } from './finance';
import type { Agreement, Patient, Payment, Session, SessionStatus } from './models';

const now = new Date('2026-11-17T15:00:00Z');

const perSession: Agreement = {
  type: 'per_session',
  amount: 15000,
  sessionsPerMonth: 4,
  chargeNoShow: false,
};
const monthly: Agreement = {
  type: 'monthly_package',
  amount: 60000,
  sessionsPerMonth: 4,
  chargeNoShow: false,
};

function patient(id: string, name: string, agreement: Agreement, active = true): Patient {
  return { id, name, phone: '', active, agreement };
}

function session(
  id: string,
  startsAt: string,
  status: SessionStatus,
  fields: Partial<Session> = {},
): Session {
  return {
    id,
    patientId: 'ana',
    startsAt: new Date(startsAt),
    calendarTitle: 'Consulta [Individual]',
    status,
    amountApplied: 0,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
    ...fields,
  };
}

function payment(id: string, patientId: string, amount: number, referenceMonth: string): Payment {
  return { id, patientId, amount, paidAt: `${referenceMonth}-10`, referenceMonth, note: '' };
}

const patients = [
  patient('ana', 'Ana', perSession),
  patient('bruno', 'Bruno', monthly),
  patient('carla', 'Carla', { ...perSession, amount: 10000 }, false),
];

const novemberSessions = [
  session('a1', '2026-11-03T13:00:00Z', 'done', { amountApplied: 15000 }),
  session('a2', '2026-11-10T13:00:00Z', 'done', { amountApplied: 15000 }),
  session('a3', '2026-11-12T13:00:00Z', 'no_show', { amountApplied: 15000 }),
  session('a4', '2026-11-13T13:00:00Z', 'cancelled'),
  session('b1', '2026-11-04T13:00:00Z', 'done', {
    patientId: 'bruno',
    packageAmountApplied: 60000,
  }),
  session('c1', '2026-11-05T13:00:00Z', 'done', { patientId: 'carla', amountApplied: 10000 }),
  session('x1', '2026-11-06T13:00:00Z', 'done', { patientId: null, amountApplied: 15000 }),
];
const payments = [payment('pay1', 'ana', 15000, '2026-11')];

function dashboardFor(
  month: string,
  options: { patients?: Patient[]; sessions?: Session[]; payments?: Payment[] } = {},
) {
  const input = {
    patients: options.patients ?? patients,
    sessions: options.sessions ?? novemberSessions,
    payments: options.payments ?? payments,
  };
  return buildDashboard({ ledger: buildLedger(input), ...input, month, now });
}

describe('buildDashboard: contagens', () => {
  it('conta atendidos distintos e status só de sessões com paciente', () => {
    const dashboard = dashboardFor('2026-11');
    expect(dashboard.patientsAttended).toBe(3);
    expect(dashboard.done).toBe(4);
    expect(dashboard.noShow).toBe(1);
    expect(dashboard.cancelled).toBe(1);
  });

  it('sessão às 23:30 do último dia (UTC-3) conta no mês anterior', () => {
    const lateSession = session('late', '2026-12-01T02:30:00Z', 'done', { amountApplied: 15000 });
    const sessions = [...novemberSessions, lateSession];
    expect(dashboardFor('2026-11', { sessions }).done).toBe(5);
    expect(dashboardFor('2026-12', { sessions }).done).toBe(0);
  });

  it('flags de sessões: mês sem sessão e mês só com sessão sem paciente', () => {
    const empty = dashboardFor('2026-08');
    expect(empty.hasSessions).toBe(false);
    expect(empty.hasLinkedSessions).toBe(false);
    expect(empty.unlinkedSessions).toBe(0);

    const onlyUnlinked = dashboardFor('2026-11', {
      sessions: [session('x', '2026-11-06T13:00:00Z', 'done', { patientId: null })],
    });
    expect(onlyUnlinked.hasSessions).toBe(true);
    expect(onlyUnlinked.hasLinkedSessions).toBe(false);
    expect(onlyUnlinked.unlinkedSessions).toBe(1);
    expect(onlyUnlinked.done).toBe(0);
    expect(onlyUnlinked.patientsAttended).toBe(0);
  });
});

describe('buildDashboard: valores', () => {
  it('Recebido e Devido vêm do resumo do mês', () => {
    const dashboard = dashboardFor('2026-11');
    const ledger = buildLedger({ patients, sessions: novemberSessions, payments });
    const summary = summarizeMonth(ledger, '2026-11');
    expect(dashboard.received).toBe(15000);
    expect(dashboard.due).toBe(100000);
    expect(dashboard.received).toBe(summary.totals.received);
    expect(dashboard.due).toBe(summary.totals.due);
  });

  it('previsto soma só pacientes ativos', () => {
    expect(dashboardFor('2026-11').expected).toBe(120000);
  });

  it('paciente com sessionsPerMonth 0 não entra no previsto', () => {
    const withZero = [
      patient('ana', 'Ana', { ...perSession, sessionsPerMonth: 0 }),
      ...patients.slice(1),
    ];
    expect(dashboardFor('2026-11', { patients: withZero }).expected).toBe(60000);
  });
});

describe('buildDashboard: mês corrente', () => {
  it('countsScheduled é true para o mês corrente e futuros, false para passados', () => {
    expect(dashboardFor('2026-11').countsScheduled).toBe(true);
    expect(dashboardFor('2026-12').countsScheduled).toBe(true);
    expect(dashboardFor('2026-10').countsScheduled).toBe(false);
  });
});

describe('buildDashboard: série', () => {
  it('os 6 meses terminam no mês selecionado', () => {
    const { series } = dashboardFor('2026-11');
    expect(series.map(point => point.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(series[5]).toEqual({ month: '2026-11', received: 15000, due: 100000 });
  });

  it('atravessa o ano e mantém meses sem movimento', () => {
    const { series } = dashboardFor('2027-02');
    expect(series.map(point => point.month)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(series[4]).toEqual({ month: '2027-01', received: 0, due: 0 });
    expect(series[5]).toEqual({ month: '2027-02', received: 0, due: 0 });
  });
});

describe('buildDashboard: alertas', () => {
  it('alerts é lista vazia nesta etapa', () => {
    expect(dashboardFor('2026-11').alerts).toEqual([]);
  });
});
