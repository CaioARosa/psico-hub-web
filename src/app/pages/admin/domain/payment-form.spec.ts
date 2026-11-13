import {
  isValidIsoDate,
  paymentToFormValue,
  referenceMonthOf,
  todayIso,
  toPaymentInput,
} from './payment-form';
import type { PaymentFormValue } from './payment-form';
import type { Payment } from './models';

const valid: PaymentFormValue = {
  patientId: 'p1',
  amount: '150,50',
  paidAt: '2026-11-27',
  referenceMonth: '2026-11',
  note: '  Pix da Ana  ',
};

describe('toPaymentInput', () => {
  it('aceita um Pix válido e converte o valor para centavos', () => {
    expect(toPaymentInput(valid)).toEqual({
      ok: true,
      value: {
        patientId: 'p1',
        amount: 15050,
        paidAt: '2026-11-27',
        referenceMonth: '2026-11',
        note: 'Pix da Ana',
      },
    });
  });

  it('rejeita valor zero com mensagem de maior que zero', () => {
    for (const amount of ['0', '0,00']) {
      expect(toPaymentInput({ ...valid, amount })).toEqual({
        ok: false,
        errors: { amount: 'O valor deve ser maior que zero.' },
      });
    }
  });

  it.each(['', ' ', 'abc', '1,234,5', '-10', '1.5'])('rejeita valor fora do formato: %j', amount => {
    expect(toPaymentInput({ ...valid, amount })).toEqual({
      ok: false,
      errors: { amount: 'Valor inválido. Use o formato 150,00.' },
    });
  });

  it.each(['2026-02-31', '2026-13-01', '2026-02-30', '26-11-27', '2026/11/27'])(
    'rejeita data impossível ou fora do formato: %j',
    paidAt => {
      expect(toPaymentInput({ ...valid, paidAt })).toEqual({
        ok: false,
        errors: { paidAt: 'Data inválida. Use uma data real no formato AAAA-MM-DD.' },
      });
    },
  );

  it('aceita datas reais, inclusive 29 de fevereiro em ano bissexto', () => {
    expect(toPaymentInput({ ...valid, paidAt: '2024-02-29' }).ok).toBe(true);
    expect(toPaymentInput({ ...valid, paidAt: '2026-02-28' }).ok).toBe(true);
  });

  it('exige a data do Pix', () => {
    expect(toPaymentInput({ ...valid, paidAt: '' })).toEqual({
      ok: false,
      errors: { paidAt: 'Informe a data do Pix.' },
    });
  });

  it.each(['2026-1', '2026-13', '11/2026', '2026-00', ''])(
    'rejeita mês de referência fora de YYYY-MM: %j',
    referenceMonth => {
      const result = toPaymentInput({ ...valid, referenceMonth });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors)).toEqual(['referenceMonth']);
    },
  );

  it('exige paciente', () => {
    expect(toPaymentInput({ ...valid, patientId: '  ' })).toEqual({
      ok: false,
      errors: { patientId: 'Escolha o paciente.' },
    });
  });

  it('acumula erros de vários campos', () => {
    const result = toPaymentInput({
      patientId: '',
      amount: 'abc',
      paidAt: '2026-02-31',
      referenceMonth: '2026-13',
      note: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['amount', 'paidAt', 'patientId', 'referenceMonth']);
    }
  });

  it('observação vazia vira string vazia', () => {
    expect(toPaymentInput({ ...valid, note: '   ' })).toMatchObject({
      ok: true,
      value: { note: '' },
    });
  });
});

describe('paymentToFormValue', () => {
  it('devolve o valor em texto brasileiro e volta ao mesmo centavos', () => {
    const payment: Payment = {
      id: 'x1',
      patientId: 'p1',
      amount: 15050,
      paidAt: '2026-11-27',
      referenceMonth: '2026-11',
      note: 'Pix da Ana',
    };
    const form = paymentToFormValue(payment);
    expect(form).toEqual({
      patientId: 'p1',
      amount: '150,50',
      paidAt: '2026-11-27',
      referenceMonth: '2026-11',
      note: 'Pix da Ana',
    });
    expect(toPaymentInput(form)).toMatchObject({ ok: true, value: { amount: 15050 } });
  });
});

describe('isValidIsoDate', () => {
  it('aceita datas reais e rejeita impossíveis', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-31')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-11-00')).toBe(false);
    expect(isValidIsoDate('2026-1-01')).toBe(false);
  });
});

describe('referenceMonthOf', () => {
  it('usa o mês da data do Pix', () => {
    expect(referenceMonthOf('2026-11-27')).toBe('2026-11');
  });

  it('devolve vazio para data inválida', () => {
    expect(referenceMonthOf('2026-02-31')).toBe('');
    expect(referenceMonthOf('')).toBe('');
  });
});

describe('todayIso', () => {
  it('usa a data em UTC-3: 02:30 UTC de 1 de dezembro ainda é 30 de novembro', () => {
    expect(todayIso(new Date('2026-12-01T02:30:00Z'))).toBe('2026-11-30');
  });

  it('usa a data de hoje em UTC-3 depois da meia-noite local', () => {
    expect(todayIso(new Date('2026-11-13T15:00:00Z'))).toBe('2026-11-13');
  });
});
