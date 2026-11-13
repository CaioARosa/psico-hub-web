import { decideRepriceWrite, planReprice } from './reprice';
import type { Agreement, Session, SessionStatus } from './models';

function session(id: string, status: SessionStatus): Session {
  return {
    id,
    patientId: 'p1',
    startsAt: new Date('2026-11-20T13:00:00.000Z'),
    calendarTitle: 'Consulta [Individual] - Ana',
    status,
    amountApplied: 0,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
  };
}

const perSession: Agreement = {
  type: 'per_session',
  amount: 18000,
  sessionsPerMonth: 4,
  chargeNoShow: true,
};
const monthly: Agreement = {
  type: 'monthly_package',
  amount: 60000,
  sessionsPerMonth: 4,
  chargeNoShow: true,
};

describe('planReprice', () => {
  it('só entra sessão scheduled; done, no_show e cancelled ficam de fora', () => {
    const plan = planReprice(
      [
        session('a', 'scheduled'),
        session('b', 'done'),
        session('c', 'no_show'),
        session('d', 'cancelled'),
        session('e', 'scheduled'),
      ],
      perSession,
    );
    expect(plan.map(item => item.id)).toEqual(['a', 'e']);
  });

  it('por sessão grava o valor da sessão e pacote zero', () => {
    expect(planReprice([session('a', 'scheduled')], perSession)).toEqual([
      { id: 'a', amountApplied: 18000, packageAmountApplied: 0 },
    ]);
  });

  it('pacote mensal grava amountApplied zero e o valor do pacote', () => {
    expect(planReprice([session('a', 'scheduled')], monthly)).toEqual([
      { id: 'a', amountApplied: 0, packageAmountApplied: 60000 },
    ]);
  });

  it('trocar de por sessão para pacote zera amountApplied', () => {
    const [item] = planReprice([{ ...session('a', 'scheduled'), amountApplied: 18000 }], monthly);
    expect(item.amountApplied).toBe(0);
    expect(item.packageAmountApplied).toBe(60000);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(planReprice([], perSession)).toEqual([]);
  });

  it('chamar duas vezes com a mesma entrada dá o mesmo resultado (idempotente)', () => {
    const sessions = [session('a', 'scheduled'), session('b', 'done')];
    expect(planReprice(sessions, monthly)).toEqual(planReprice(sessions, monthly));
  });
});

describe('decideRepriceWrite', () => {
  const planned = { amountApplied: 18000, packageAmountApplied: 0 };

  it('sessão ainda scheduled recebe os valores planejados', () => {
    expect(decideRepriceWrite({ status: 'scheduled' }, planned)).toEqual({
      amountApplied: 18000,
      packageAmountApplied: 0,
    });
  });

  it.each(['done', 'no_show', 'cancelled'] as const)('sessão %s não é regravada', status => {
    expect(decideRepriceWrite({ status }, planned)).toBeNull();
  });

  it('documento inexistente não é regravado', () => {
    expect(decideRepriceWrite(undefined, planned)).toBeNull();
  });
});
