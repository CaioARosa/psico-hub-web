import { allocateCredits, buildLedger, dueByMonth, summarizeMonth } from './finance';
import type { MonthAllocation } from './finance';
import type { Agreement, Patient, Payment, Session, SessionStatus } from './models';

const perSession: Agreement = {
  type: 'per_session',
  amount: 15000,
  sessionsPerMonth: 2,
  chargeNoShow: true,
};
const perSessionNoCharge: Agreement = { ...perSession, chargeNoShow: false };
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
    patientId: 'p1',
    startsAt: new Date(startsAt),
    calendarTitle: 'Consulta [Individual] - Ana',
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

const ana = patient('p1', 'Ana', perSession);
const anaMonthly = patient('p1', 'Ana', monthly);

describe('dueByMonth: devido por sessão', () => {
  it('só sessões realizadas contam: duas de 15000 somam 30000', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'done', { amountApplied: 15000 }),
      session('b', '2026-11-10T13:00:00.000Z', 'done', { amountApplied: 15000 }),
    ];
    expect(dueByMonth(ana, sessions)).toEqual(new Map([['2026-11', 30000]]));
  });

  it('falta com chargeNoShowApplied true conta, mesmo com o acordo atual sem cobrar faltas', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'no_show', {
        amountApplied: 15000,
        chargeNoShowApplied: true,
      }),
    ];
    expect(dueByMonth(patient('p1', 'Ana', perSessionNoCharge), sessions)).toEqual(
      new Map([['2026-11', 15000]]),
    );
  });

  it('falta com chargeNoShowApplied false não conta, mesmo com o acordo atual cobrando faltas', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'no_show', {
        amountApplied: 15000,
        chargeNoShowApplied: false,
      }),
    ];
    expect(dueByMonth(ana, sessions).size).toBe(0);
  });

  it('falta sem o campo (null) segue o chargeNoShow atual do paciente', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'no_show', { amountApplied: 15000 }),
    ];
    expect(dueByMonth(ana, sessions)).toEqual(new Map([['2026-11', 15000]]));
    expect(dueByMonth(patient('p1', 'Ana', perSessionNoCharge), sessions).size).toBe(0);
  });

  it('mudar o cobrar faltas do paciente não altera uma falta já marcada', () => {
    const marked = session('a', '2026-11-03T13:00:00.000Z', 'no_show', {
      amountApplied: 15000,
      chargeNoShowApplied: true,
    });
    expect(dueByMonth(patient('p1', 'Ana', perSessionNoCharge), [marked])).toEqual(
      new Map([['2026-11', 15000]]),
    );
    expect(dueByMonth(ana, [{ ...marked, chargeNoShowApplied: false }]).size).toBe(0);
  });

  it('cancelled e scheduled nunca contam', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'cancelled', { amountApplied: 15000 }),
      session('b', '2026-11-10T13:00:00.000Z', 'scheduled', { amountApplied: 15000 }),
    ];
    expect(dueByMonth(ana, sessions).size).toBe(0);
  });

  it('sessões de outros pacientes e sem paciente são ignoradas', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'done', { patientId: 'p2', amountApplied: 15000 }),
      session('b', '2026-11-04T13:00:00.000Z', 'done', { patientId: null, amountApplied: 15000 }),
      session('c', '2026-11-05T13:00:00.000Z', 'done', { amountApplied: 15000 }),
    ];
    expect(dueByMonth(ana, sessions)).toEqual(new Map([['2026-11', 15000]]));
  });
});

describe('dueByMonth: devido de pacote', () => {
  it('vale o pacote da primeira sessão não cancelada por data, não pela ordem do array', () => {
    const sessions = [
      session('c', '2026-11-17T13:00:00.000Z', 'scheduled', { packageAmountApplied: 50000 }),
      session('a', '2026-11-03T13:00:00.000Z', 'cancelled', { packageAmountApplied: 70000 }),
      session('b', '2026-11-10T13:00:00.000Z', 'scheduled', { packageAmountApplied: 60000 }),
    ];
    expect(dueByMonth(anaMonthly, sessions)).toEqual(new Map([['2026-11', 60000]]));
  });

  it('mês só com sessões canceladas não gera cobrança de pacote nem de sessão', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'cancelled', {
        amountApplied: 15000,
        packageAmountApplied: 60000,
      }),
      session('b', '2026-11-10T13:00:00.000Z', 'cancelled', {
        amountApplied: 15000,
        packageAmountApplied: 60000,
      }),
    ];
    expect(dueByMonth(anaMonthly, sessions).size).toBe(0);
  });

  it('no_show conta como primeira sessão do pacote', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'no_show', {
        packageAmountApplied: 60000,
        chargeNoShowApplied: false,
      }),
      session('b', '2026-11-10T13:00:00.000Z', 'done', { packageAmountApplied: 70000 }),
    ];
    expect(dueByMonth(anaMonthly, sessions)).toEqual(new Map([['2026-11', 60000]]));
  });

  it('o valor de novembro não muda quando dezembro tem packageAmountApplied 70000', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'done', { packageAmountApplied: 60000 }),
      session('b', '2026-12-02T13:00:00.000Z', 'scheduled', { packageAmountApplied: 70000 }),
    ];
    expect(dueByMonth(anaMonthly, sessions)).toEqual(
      new Map([
        ['2026-11', 60000],
        ['2026-12', 70000],
      ]),
    );
  });

  it('pacote sem valor congelado (null) usa agreement.amount quando o acordo atual é pacote', () => {
    const sessions = [session('a', '2026-11-03T13:00:00.000Z', 'scheduled')];
    expect(dueByMonth(anaMonthly, sessions)).toEqual(new Map([['2026-11', 60000]]));
  });

  it('pacote sem valor congelado (null) vale 0 quando o acordo atual é por sessão', () => {
    const sessions = [session('a', '2026-11-03T13:00:00.000Z', 'scheduled')];
    expect(dueByMonth(ana, sessions).size).toBe(0);
  });

  it('duas sessões no mês contam o pacote uma vez só', () => {
    const sessions = [
      session('a', '2026-11-03T13:00:00.000Z', 'scheduled', { packageAmountApplied: 60000 }),
      session('b', '2026-11-10T13:00:00.000Z', 'scheduled', { packageAmountApplied: 60000 }),
    ];
    expect(dueByMonth(anaMonthly, sessions)).toEqual(new Map([['2026-11', 60000]]));
  });
});

describe('dueByMonth: mês pela data em UTC-3', () => {
  it('sessão às 23:30 do último dia (2026-12-01T02:30Z) entra em novembro', () => {
    const sessions = [session('a', '2026-12-01T02:30:00.000Z', 'done', { amountApplied: 15000 })];
    expect(dueByMonth(ana, sessions)).toEqual(new Map([['2026-11', 15000]]));
  });

  it('sessão em 2026-12-01T03:00Z entra em dezembro', () => {
    const sessions = [session('a', '2026-12-01T03:00:00.000Z', 'done', { amountApplied: 15000 })];
    expect(dueByMonth(ana, sessions)).toEqual(new Map([['2026-12', 15000]]));
  });

  it('a primeira sessão do mês é a de UTC-3: 23:30 de novembro conta como novembro', () => {
    const sessions = [
      session('a', '2026-12-01T02:30:00.000Z', 'scheduled', { packageAmountApplied: 60000 }),
      session('b', '2026-12-01T03:00:00.000Z', 'scheduled', { packageAmountApplied: 70000 }),
    ];
    expect(dueByMonth(anaMonthly, sessions)).toEqual(
      new Map([
        ['2026-11', 60000],
        ['2026-12', 70000],
      ]),
    );
  });
});

describe('allocateCredits', () => {
  it('excedente do mês seguinte abate o atraso do mês anterior', () => {
    const result = allocateCredits(
      new Map([
        ['2026-10', 30000],
        ['2026-11', 15000],
      ]),
      new Map([
        ['2026-10', 10000],
        ['2026-11', 35000],
      ]),
    );
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-10',
        due: 30000,
        received: 10000,
        abated: 20000,
        toReceive: 0,
        credit: 0,
        sources: [{ fromMonth: '2026-11', amount: 20000 }],
      },
      {
        month: '2026-11',
        due: 15000,
        received: 35000,
        abated: 0,
        toReceive: 0,
        credit: 0,
        sources: [],
      },
    ]);
  });

  it('Pix adiantado de dezembro abate parte do déficit de outubro', () => {
    const result = allocateCredits(new Map([['2026-10', 20000]]), new Map([['2026-12', 15000]]));
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-10',
        due: 20000,
        received: 0,
        abated: 15000,
        toReceive: 5000,
        credit: 0,
        sources: [{ fromMonth: '2026-12', amount: 15000 }],
      },
      {
        month: '2026-12',
        due: 0,
        received: 15000,
        abated: 0,
        toReceive: 0,
        credit: 0,
        sources: [],
      },
    ]);
  });

  it('sobra do Pix vira crédito: Pix 50000 contra déficit 20000 deixa crédito 30000', () => {
    const result = allocateCredits(new Map([['2026-10', 20000]]), new Map([['2026-11', 50000]]));
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-10',
        due: 20000,
        received: 0,
        abated: 20000,
        toReceive: 0,
        credit: 0,
        sources: [{ fromMonth: '2026-11', amount: 20000 }],
      },
      {
        month: '2026-11',
        due: 0,
        received: 50000,
        abated: 0,
        toReceive: 0,
        credit: 30000,
        sources: [],
      },
    ]);
  });

  it('abate vários déficits do mais antigo para o mais novo', () => {
    const result = allocateCredits(
      new Map([
        ['2026-08', 10000],
        ['2026-09', 10000],
        ['2026-10', 10000],
      ]),
      new Map([['2026-11', 25000]]),
    );
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-08',
        due: 10000,
        received: 0,
        abated: 10000,
        toReceive: 0,
        credit: 0,
        sources: [{ fromMonth: '2026-11', amount: 10000 }],
      },
      {
        month: '2026-09',
        due: 10000,
        received: 0,
        abated: 10000,
        toReceive: 0,
        credit: 0,
        sources: [{ fromMonth: '2026-11', amount: 10000 }],
      },
      {
        month: '2026-10',
        due: 10000,
        received: 0,
        abated: 5000,
        toReceive: 5000,
        credit: 0,
        sources: [{ fromMonth: '2026-11', amount: 5000 }],
      },
      {
        month: '2026-11',
        due: 0,
        received: 25000,
        abated: 0,
        toReceive: 0,
        credit: 0,
        sources: [],
      },
    ]);
  });

  it('crédito de mês antigo não abate déficit de mês posterior', () => {
    const result = allocateCredits(new Map([['2026-10', 20000]]), new Map([['2026-09', 10000]]));
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-09',
        due: 0,
        received: 10000,
        abated: 0,
        toReceive: 0,
        credit: 10000,
        sources: [],
      },
      {
        month: '2026-10',
        due: 20000,
        received: 0,
        abated: 0,
        toReceive: 20000,
        credit: 0,
        sources: [],
      },
    ]);
  });

  it('toReceive nunca fica negativo e o crédito não sobe para meses anteriores', () => {
    const result = allocateCredits(
      new Map([
        ['2026-10', 10000],
        ['2026-11', 5000],
      ]),
      new Map([
        ['2026-10', 30000],
        ['2026-12', 2000],
      ]),
    );
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-10',
        due: 10000,
        received: 30000,
        abated: 0,
        toReceive: 0,
        credit: 20000,
        sources: [],
      },
      {
        month: '2026-11',
        due: 5000,
        received: 0,
        abated: 2000,
        toReceive: 3000,
        credit: 0,
        sources: [{ fromMonth: '2026-12', amount: 2000 }],
      },
      {
        month: '2026-12',
        due: 0,
        received: 2000,
        abated: 0,
        toReceive: 0,
        credit: 0,
        sources: [],
      },
    ]);
  });

  it('sem Pix posterior, o déficit inteiro fica a receber', () => {
    const result = allocateCredits(new Map([['2026-10', 30000]]), new Map([['2026-10', 10000]]));
    expect(result).toEqual<MonthAllocation[]>([
      {
        month: '2026-10',
        due: 30000,
        received: 10000,
        abated: 0,
        toReceive: 20000,
        credit: 0,
        sources: [],
      },
    ]);
  });

  it('ordena os meses em ordem crescente, mesmo com os Maps fora de ordem', () => {
    const result = allocateCredits(
      new Map([
        ['2026-11', 15000],
        ['2026-10', 30000],
      ]),
      new Map([
        ['2026-11', 35000],
        ['2026-10', 10000],
      ]),
    );
    expect(result.map(allocation => allocation.month)).toEqual(['2026-10', '2026-11']);
  });

  it('sem entradas devolve lista vazia', () => {
    expect(allocateCredits(new Map(), new Map())).toEqual([]);
  });
});

describe('summarizeMonth', () => {
  const scenario = () => ({
    patients: [ana, patient('p2', 'Bruno', monthly)],
    sessions: [
      session('a1', '2026-10-05T13:00:00.000Z', 'done', { amountApplied: 15000 }),
      session('a2', '2026-11-03T13:00:00.000Z', 'done', { amountApplied: 15000 }),
      session('a3', '2026-11-10T13:00:00.000Z', 'done', { amountApplied: 15000 }),
      session('b1', '2026-11-04T13:00:00.000Z', 'scheduled', {
        patientId: 'p2',
        packageAmountApplied: 60000,
      }),
    ],
    payments: [payment('x1', 'p1', 10000, '2026-11')],
  });

  it('linhas e cartões de novembro: Ana com atraso de outubro, Bruno só com o pacote', () => {
    expect(summarizeMonth(buildLedger(scenario()), '2026-11')).toEqual({
      month: '2026-11',
      received: 10000,
      toReceive: 80000,
      overdue: 15000,
      totals: {
        due: 90000,
        received: 10000,
        abated: 0,
        toReceive: 80000,
        overdue: 15000,
        credit: 0,
      },
      hasSessions: true,
      hasLinkedSessions: true,
      unlinkedSessions: 0,
      lines: [
        {
          patientId: 'p1',
          month: '2026-11',
          due: 30000,
          received: 10000,
          abated: 0,
          toReceive: 20000,
          overdue: 15000,
          credit: 0,
          sources: [],
        },
        {
          patientId: 'p2',
          month: '2026-11',
          due: 60000,
          received: 0,
          abated: 0,
          toReceive: 60000,
          overdue: 0,
          credit: 0,
          sources: [],
        },
      ],
    });
  });

  it('cartões são exatamente a soma das linhas, em todos os meses', () => {
    const ledger = buildLedger(scenario());
    for (const month of ['2026-10', '2026-11', '2026-12']) {
      const summary = summarizeMonth(ledger, month);
      const sum = (pick: (line: (typeof summary.lines)[number]) => number) =>
        summary.lines.reduce((total, line) => total + pick(line), 0);
      expect(summary.received).toBe(sum(line => line.received));
      expect(summary.toReceive).toBe(sum(line => line.toReceive));
      expect(summary.overdue).toBe(sum(line => line.overdue));
      expect(summary.totals).toEqual({
        due: sum(line => line.due),
        received: sum(line => line.received),
        abated: sum(line => line.abated),
        toReceive: sum(line => line.toReceive),
        overdue: sum(line => line.overdue),
        credit: sum(line => line.credit),
      });
    }
  });

  it('overdue soma os toReceive dos meses anteriores e aparece mesmo sem movimento no mês', () => {
    expect(summarizeMonth(buildLedger(scenario()), '2026-12')).toEqual({
      month: '2026-12',
      received: 0,
      toReceive: 0,
      overdue: 95000,
      totals: { due: 0, received: 0, abated: 0, toReceive: 0, overdue: 95000, credit: 0 },
      hasSessions: false,
      hasLinkedSessions: false,
      unlinkedSessions: 0,
      lines: [
        {
          patientId: 'p1',
          month: '2026-12',
          due: 0,
          received: 0,
          abated: 0,
          toReceive: 0,
          overdue: 35000,
          credit: 0,
          sources: [],
        },
        {
          patientId: 'p2',
          month: '2026-12',
          due: 0,
          received: 0,
          abated: 0,
          toReceive: 0,
          overdue: 60000,
          credit: 0,
          sources: [],
        },
      ],
    });
  });

  it('paciente sem movimento no mês não aparece na linha', () => {
    const october = summarizeMonth(buildLedger(scenario()), '2026-10');
    expect(october.lines.map(line => line.patientId)).toEqual(['p1']);
    expect(october.toReceive).toBe(15000);
  });

  it('paciente inativo com Pix aparece com o crédito', () => {
    const summary = summarizeMonth(
      buildLedger({
        patients: [patient('p3', 'Diana', perSession, false)],
        sessions: [],
        payments: [payment('x1', 'p3', 20000, '2026-11')],
      }),
      '2026-11',
    );
    expect(summary.lines).toEqual([
      {
        patientId: 'p3',
        month: '2026-11',
        due: 0,
        received: 20000,
        abated: 0,
        toReceive: 0,
        overdue: 0,
        credit: 20000,
        sources: [],
      },
    ]);
  });

  it('Pix de paciente removido entra no recebido do mês', () => {
    const summary = summarizeMonth(
      buildLedger({
        patients: [],
        sessions: [],
        payments: [payment('x1', 'gone', 5000, '2026-11')],
      }),
      '2026-11',
    );
    expect(summary.received).toBe(5000);
    expect(summary.lines.map(line => line.patientId)).toEqual(['gone']);
  });

  it('sessão realizada de paciente removido gera devido pelo valor congelado', () => {
    const summary = summarizeMonth(
      buildLedger({
        patients: [],
        sessions: [
          session('a', '2026-11-03T13:00:00.000Z', 'done', {
            patientId: 'gone',
            amountApplied: 15000,
          }),
        ],
        payments: [],
      }),
      '2026-11',
    );
    expect(summary.toReceive).toBe(15000);
  });

  it('lines ordenadas pelo nome do paciente', () => {
    const summary = summarizeMonth(
      buildLedger({
        patients: [
          patient('p3', 'Carla', perSession),
          patient('p2', 'Bruno', perSession),
          patient('p1', 'Ana', perSession),
        ],
        sessions: [],
        payments: [
          payment('x1', 'p3', 1000, '2026-11'),
          payment('x2', 'p2', 1000, '2026-11'),
          payment('x3', 'p1', 1000, '2026-11'),
        ],
      }),
      '2026-11',
    );
    expect(summary.lines.map(line => line.patientId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('pacientes isolados: o Pix de Bruno não abate o atraso de Ana', () => {
    const ledger = buildLedger({
      patients: [ana, patient('p2', 'Bruno', monthly)],
      sessions: [session('a1', '2026-10-05T13:00:00.000Z', 'done', { amountApplied: 20000 })],
      payments: [payment('x1', 'p2', 50000, '2026-11')],
    });
    expect(summarizeMonth(ledger, '2026-10').lines).toEqual([
      {
        patientId: 'p1',
        month: '2026-10',
        due: 20000,
        received: 0,
        abated: 0,
        toReceive: 20000,
        overdue: 0,
        credit: 0,
        sources: [],
      },
    ]);
    expect(summarizeMonth(ledger, '2026-11').lines).toEqual([
      {
        patientId: 'p1',
        month: '2026-11',
        due: 0,
        received: 0,
        abated: 0,
        toReceive: 0,
        overdue: 20000,
        credit: 0,
        sources: [],
      },
      {
        patientId: 'p2',
        month: '2026-11',
        due: 0,
        received: 50000,
        abated: 0,
        toReceive: 0,
        overdue: 0,
        credit: 50000,
        sources: [],
      },
    ]);
  });

  it('Pix adiantado de dezembro aparece como abatimento na linha de outubro', () => {
    const ledger = buildLedger({
      patients: [ana],
      sessions: [session('a1', '2026-10-05T13:00:00.000Z', 'done', { amountApplied: 20000 })],
      payments: [payment('x1', 'p1', 15000, '2026-12')],
    });
    expect(summarizeMonth(ledger, '2026-10').lines).toEqual([
      {
        patientId: 'p1',
        month: '2026-10',
        due: 20000,
        received: 0,
        abated: 15000,
        toReceive: 5000,
        overdue: 0,
        credit: 0,
        sources: [{ fromMonth: '2026-12', amount: 15000 }],
      },
    ]);
    expect(summarizeMonth(ledger, '2026-12').overdue).toBe(5000);
  });

  it('sessão às 23:30 do último dia cai em novembro no resumo', () => {
    const ledger = buildLedger({
      patients: [ana],
      sessions: [session('a', '2026-12-01T02:30:00.000Z', 'done', { amountApplied: 15000 })],
      payments: [],
    });
    expect(summarizeMonth(ledger, '2026-11')).toMatchObject({
      toReceive: 15000,
      hasSessions: true,
    });
    expect(summarizeMonth(ledger, '2026-12').hasSessions).toBe(false);
  });

  it('hasSessions vale para qualquer sessão, inclusive a sem paciente', () => {
    const ledger = buildLedger({
      patients: [],
      sessions: [session('a', '2026-11-03T13:00:00.000Z', 'cancelled', { patientId: null })],
      payments: [],
    });
    expect(summarizeMonth(ledger, '2026-11')).toMatchObject({ hasSessions: true, lines: [] });
    expect(summarizeMonth(ledger, '2026-10').hasSessions).toBe(false);
  });

  it('hasLinkedSessions é falso em mês só com sessões sem paciente, que seguem em hasSessions e unlinkedSessions', () => {
    const ledger = buildLedger({
      patients: [ana],
      sessions: [
        session('u1', '2026-11-03T13:00:00.000Z', 'done', { patientId: null, amountApplied: 15000 }),
      ],
      payments: [],
    });
    expect(summarizeMonth(ledger, '2026-11')).toMatchObject({
      hasSessions: true,
      hasLinkedSessions: false,
      unlinkedSessions: 1,
    });
  });

  it('hasLinkedSessions vale para sessão vinculada de qualquer status, inclusive cancelada', () => {
    const ledger = buildLedger({
      patients: [ana],
      sessions: [session('a', '2026-11-03T13:00:00.000Z', 'cancelled')],
      payments: [],
    });
    expect(summarizeMonth(ledger, '2026-11')).toMatchObject({ hasLinkedSessions: true });
  });

  it('hasLinkedSessions e hasSessions são falsos em mês sem sessões', () => {
    const ledger = buildLedger({ patients: [ana], sessions: [], payments: [] });
    expect(summarizeMonth(ledger, '2026-11')).toMatchObject({
      hasSessions: false,
      hasLinkedSessions: false,
    });
  });

  it('sessões sem paciente contam por mês, de qualquer status, e ficam fora dos valores', () => {
    const ledger = buildLedger({
      patients: [ana],
      sessions: [
        session('u1', '2026-11-03T13:00:00.000Z', 'done', {
          patientId: null,
          amountApplied: 15000,
        }),
        session('u2', '2026-11-10T13:00:00.000Z', 'cancelled', { patientId: null }),
        session('u3', '2026-10-05T13:00:00.000Z', 'scheduled', { patientId: null }),
        session('a1', '2026-11-12T13:00:00.000Z', 'done', { amountApplied: 15000 }),
      ],
      payments: [],
    });
    expect(summarizeMonth(ledger, '2026-11').unlinkedSessions).toBe(2);
    expect(summarizeMonth(ledger, '2026-10').unlinkedSessions).toBe(1);
    expect(summarizeMonth(ledger, '2026-12').unlinkedSessions).toBe(0);
    expect(summarizeMonth(ledger, '2026-11').toReceive).toBe(15000);
  });

  it('mês só com sessões sem paciente: zera os valores e mantém hasSessions', () => {
    const ledger = buildLedger({
      patients: [ana],
      sessions: [
        session('u1', '2026-11-03T13:00:00.000Z', 'done', {
          patientId: null,
          amountApplied: 15000,
        }),
        session('u2', '2026-11-10T13:00:00.000Z', 'cancelled', { patientId: null }),
      ],
      payments: [],
    });
    expect(summarizeMonth(ledger, '2026-11')).toEqual({
      month: '2026-11',
      received: 0,
      toReceive: 0,
      overdue: 0,
      totals: { due: 0, received: 0, abated: 0, toReceive: 0, overdue: 0, credit: 0 },
      hasSessions: true,
      hasLinkedSessions: false,
      unlinkedSessions: 2,
      lines: [],
    });
  });

  it('totals soma as seis colunas das linhas, inclusive abatimento e crédito', () => {
    const ledger = buildLedger({
      patients: [ana, patient('p2', 'Bruno', monthly)],
      sessions: [
        session('a1', '2026-11-03T13:00:00.000Z', 'done', { amountApplied: 20000 }),
        session('b1', '2026-11-04T13:00:00.000Z', 'scheduled', {
          patientId: 'p2',
          packageAmountApplied: 60000,
        }),
      ],
      payments: [payment('x1', 'p1', 40000, '2026-12'), payment('x2', 'p2', 70000, '2026-11')],
    });
    expect(summarizeMonth(ledger, '2026-11').totals).toEqual({
      due: 80000,
      received: 70000,
      abated: 20000,
      toReceive: 0,
      overdue: 0,
      credit: 10000,
    });
  });

  it('sem pacientes, sessões ou pagamentos, o resumo é zerado', () => {
    expect(
      summarizeMonth(buildLedger({ patients: [], sessions: [], payments: [] }), '2026-11'),
    ).toEqual({
      month: '2026-11',
      received: 0,
      toReceive: 0,
      overdue: 0,
      totals: { due: 0, received: 0, abated: 0, toReceive: 0, overdue: 0, credit: 0 },
      hasSessions: false,
      hasLinkedSessions: false,
      unlinkedSessions: 0,
      lines: [],
    });
  });
});
