import { chargeFromDoc, chargeId, chargeToDoc } from './charge-doc';
import { buildChargeQueue } from './charge-queue';
import type { PatientMonthLine } from './finance';
import type { Patient } from './models';

const now = new Date('2026-11-24T15:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

function patient(id: string, name: string, phone = '11988887777'): Patient {
  return {
    id,
    name,
    phone,
    active: true,
    agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: false },
  };
}

function line(patientId: string, overrides: Partial<PatientMonthLine> = {}): PatientMonthLine {
  return {
    patientId,
    month: '2026-11',
    due: 0,
    received: 0,
    abated: 0,
    toReceive: 0,
    overdue: 0,
    credit: 0,
    sources: [],
    ...overrides,
  };
}

const patients = new Map([
  ['p1', patient('p1', 'Ana Paula')],
  ['p2', patient('p2', 'Bruno Lima')],
  ['p3', patient('p3', 'Carla Dias')],
]);

function queueOf(lines: PatientMonthLine[], charges = new Map<string, Date>(), hasLinkedSessions = true) {
  return buildChargeQueue({ lines, patients, charges, hasLinkedSessions, now });
}

describe('buildChargeQueue', () => {
  it('entra só quem tem atraso e o total é a receber mais atraso', () => {
    const queue = queueOf([
      line('p1', { toReceive: 15000, overdue: 30000 }),
      line('p2', { toReceive: 15000, overdue: 0 }),
    ]);

    expect(queue.items.map(item => [item.patientId, item.totalCents])).toEqual([['p1', 45000]]);
  });

  it('fica vazia em mês sem sessões vinculadas', () => {
    const queue = queueOf([line('p1', { overdue: 30000 })], new Map(), false);

    expect(queue.items).toEqual([]);
    expect(queue.invalidPhone).toEqual([]);
  });

  it('deixa de fora paciente removido (fora do cadastro)', () => {
    expect(queueOf([line('gone', { overdue: 30000 })]).items).toEqual([]);
  });

  it('telefone inválido sai da fila e vai para invalidPhone', () => {
    const withBadPhone = new Map(patients).set('p1', patient('p1', 'Ana Paula', '1234'));

    const queue = buildChargeQueue({
      lines: [line('p1', { overdue: 30000 }), line('p2', { overdue: 10000 })],
      patients: withBadPhone,
      charges: new Map(),
      hasLinkedSessions: true,
      now,
    });

    expect(queue.items.map(item => item.patientId)).toEqual(['p2']);
    expect(queue.invalidPhone).toEqual([{ patientId: 'p1', name: 'Ana Paula' }]);
  });

  it('ordena: nunca cobradas, depois a cobrança mais antiga, depois maior valor, depois nome', () => {
    const queue = queueOf(
      [
        line('p1', { overdue: 10000 }),
        line('p2', { overdue: 50000 }),
        line('p3', { overdue: 50000 }),
      ],
      new Map([['p1', daysAgo(20)]]),
    );

    expect(queue.items.map(item => item.patientId)).toEqual(['p2', 'p3', 'p1']);
  });

  it('cobrada há menos de 7 dias vai para o fim como cobrada recentemente; 7 dias exatos volta a ser pendente', () => {
    const queue = queueOf(
      [line('p1', { overdue: 90000 }), line('p2', { overdue: 10000 }), line('p3', { overdue: 20000 })],
      new Map([
        ['p1', daysAgo(2)],
        ['p3', daysAgo(7)],
      ]),
    );

    expect(queue.items.map(item => [item.patientId, item.recentlyCharged])).toEqual([
      ['p2', false],
      ['p3', false],
      ['p1', true],
    ]);
  });
});

describe('charge-doc', () => {
  it('monta o id do documento por paciente e mês', () => {
    expect(chargeId('p1', '2026-11')).toBe('p1_2026-11');
  });

  it('chargeToDoc guarda só paciente, mês, data e valor', () => {
    const chargedAt = new Date('2026-11-24T15:00:00Z');
    expect(chargeToDoc('p1', '2026-11', 45000, chargedAt)).toEqual({
      patientId: 'p1',
      month: '2026-11',
      chargedAt,
      amount: 45000,
    });
  });

  it('chargeFromDoc aceita Timestamp (toDate) e Date', () => {
    const date = new Date('2026-11-24T15:00:00Z');
    const fromTimestamp = chargeFromDoc({ patientId: 'p1', month: '2026-11', amount: 100, chargedAt: { toDate: () => date } });
    const fromDate = chargeFromDoc({ patientId: 'p1', month: '2026-11', amount: 100, chargedAt: date });

    expect(fromTimestamp.chargedAt).toEqual(date);
    expect(fromDate.chargedAt).toEqual(date);
    expect(fromDate).toMatchObject({ patientId: 'p1', month: '2026-11', amount: 100 });
  });
});
