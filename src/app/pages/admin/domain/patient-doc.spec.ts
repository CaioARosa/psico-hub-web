import { newPatientDoc, patientFromDoc, patientToDoc } from './patient-doc';
import type { PatientInput } from './patient-form';

const doc = {
  name: 'Maria Souza',
  phone: '(11) 98888-7777',
  active: true,
  agreement: { type: 'monthly_package', amount: 60000, sessionsPerMonth: 4, chargeNoShow: true },
};

describe('patientFromDoc', () => {
  it('monta o Patient com o id do documento', () => {
    expect(patientFromDoc('abc', doc)).toEqual({ id: 'abc', ...doc });
  });

  it('usa padrões seguros para campos ausentes', () => {
    expect(patientFromDoc('x', { name: 'Ana' })).toEqual({
      id: 'x',
      name: 'Ana',
      phone: '',
      active: true,
      agreement: { type: 'per_session', amount: 0, sessionsPerMonth: 1, chargeNoShow: false },
    });
  });
});

describe('patientToDoc', () => {
  it('grava o valor em centavos e sessões como números', () => {
    const input: PatientInput = {
      name: 'Maria Souza',
      phone: '(11) 98888-7777',
      agreement: { type: 'monthly_package', amount: 60000, sessionsPerMonth: 4, chargeNoShow: true },
    };
    expect(patientToDoc(input)).toEqual({
      name: 'Maria Souza',
      phone: '(11) 98888-7777',
      agreement: { type: 'monthly_package', amount: 60000, sessionsPerMonth: 4, chargeNoShow: true },
    });
  });
});

describe('newPatientDoc', () => {
  it('é o documento de um novo paciente: mesmo mapeamento, sempre ativo', () => {
    const input: PatientInput = {
      name: 'Maria Souza',
      phone: '(11) 98888-7777',
      agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: false },
    };
    expect(newPatientDoc(input)).toEqual({ ...patientToDoc(input), active: true });
    expect(newPatientDoc(input).active).toBe(true);
  });
});
