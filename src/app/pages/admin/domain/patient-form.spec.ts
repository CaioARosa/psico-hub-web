import { patientToFormValue, toPatientInput } from './patient-form';
import type { PatientFormValue } from './patient-form';

const valid: PatientFormValue = {
  name: '  Maria Souza ',
  phone: ' (11) 98888-7777 ',
  type: 'per_session',
  amount: '150,50',
  sessionsPerMonth: '4',
  chargeNoShow: false,
};

describe('toPatientInput', () => {
  it('aceita valores válidos e converte o valor para centavos', () => {
    expect(toPatientInput(valid)).toEqual({
      ok: true,
      value: {
        name: 'Maria Souza',
        phone: '(11) 98888-7777',
        agreement: { type: 'per_session', amount: 15050, sessionsPerMonth: 4, chargeNoShow: false },
      },
    });
  });

  it('rejeita nome vazio', () => {
    const result = toPatientInput({ ...valid, name: '   ' });
    expect(result).toEqual({ ok: false, errors: { name: 'Informe o nome.' } });
  });

  it('rejeita telefone vazio ou com menos de 10 dígitos', () => {
    for (const phone of ['', '   ', '1234-567', 'abc']) {
      expect(toPatientInput({ ...valid, phone })).toEqual({
        ok: false,
        errors: { phone: 'Informe o telefone.' },
      });
    }
  });

  it('aceita telefone com 10 dígitos', () => {
    expect(toPatientInput({ ...valid, phone: '11 3333-4444' }).ok).toBe(true);
  });

  it.each(['', 'abc', '1,234,5', '-10'])('rejeita valor inválido: %j', amount => {
    expect(toPatientInput({ ...valid, amount })).toEqual({
      ok: false,
      errors: { amount: 'Valor inválido. Use o formato 150,00.' },
    });
  });

  it.each(['0', '-1', '2,5', '1.5', 'abc', '', ' '])(
    'rejeita sessões por mês zero, negativo ou decimal: %j',
    sessionsPerMonth => {
      expect(toPatientInput({ ...valid, sessionsPerMonth })).toEqual({
        ok: false,
        errors: { sessionsPerMonth: 'Informe um número inteiro de sessões por mês (mínimo 1).' },
      });
    },
  );

  it('acumula erros de vários campos', () => {
    const result = toPatientInput({ ...valid, name: '', amount: 'x', sessionsPerMonth: '0' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['amount', 'name', 'sessionsPerMonth']);
    }
  });

  it('preserva o tipo monthly_package e chargeNoShow', () => {
    const result = toPatientInput({ ...valid, type: 'monthly_package', amount: '600', chargeNoShow: true });
    expect(result).toMatchObject({
      ok: true,
      value: { agreement: { type: 'monthly_package', amount: 60000, chargeNoShow: true } },
    });
  });
});

describe('patientToFormValue', () => {
  it('converte centavos para texto no formato brasileiro e ida e volta preserva o valor', () => {
    const form = patientToFormValue({
      id: 'p1',
      name: 'Maria Souza',
      phone: '(11) 98888-7777',
      active: true,
      agreement: { type: 'monthly_package', amount: 60005, sessionsPerMonth: 4, chargeNoShow: true },
    });
    expect(form).toEqual({
      name: 'Maria Souza',
      phone: '(11) 98888-7777',
      type: 'monthly_package',
      amount: '600,05',
      sessionsPerMonth: '4',
      chargeNoShow: true,
    });
    expect(toPatientInput(form)).toMatchObject({ ok: true, value: { agreement: { amount: 60005 } } });
  });
});
