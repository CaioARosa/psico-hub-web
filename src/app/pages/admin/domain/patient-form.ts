import type { AgreementType, Patient } from './models';
import { parseBRLToCents } from './money';

export interface PatientFormValue {
  name: string;
  phone: string;
  type: AgreementType;
  amount: string;
  sessionsPerMonth: string;
  chargeNoShow: boolean;
}

export type PatientInput = Omit<Patient, 'id' | 'active'>;
export type PatientFormField = 'name' | 'phone' | 'amount' | 'sessionsPerMonth';
export type PatientFormErrors = Partial<Record<PatientFormField, string>>;

export type PatientInputResult =
  | { ok: true; value: PatientInput }
  | { ok: false; errors: PatientFormErrors };

const MIN_PHONE_DIGITS = 10;

export function patientToFormValue(patient: Patient): PatientFormValue {
  const { agreement } = patient;
  return {
    name: patient.name,
    phone: patient.phone,
    type: agreement.type,
    amount: (agreement.amount / 100).toFixed(2).replace('.', ','),
    sessionsPerMonth: String(agreement.sessionsPerMonth),
    chargeNoShow: agreement.chargeNoShow,
  };
}

export function toPatientInput(value: PatientFormValue): PatientInputResult {
  const errors: PatientFormErrors = {};

  const name = value.name.trim();
  if (name === '') errors.name = 'Informe o nome.';

  const phone = value.phone.trim();
  if (phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS) errors.phone = 'Informe o telefone.';

  const amount = parseBRLToCents(value.amount ?? '');
  if (amount === null) errors.amount = 'Valor inválido. Use o formato 150,00.';

  const sessionsText = (value.sessionsPerMonth ?? '').trim();
  const sessionsPerMonth = /^\d+$/.test(sessionsText) ? Number(sessionsText) : 0;
  if (!Number.isSafeInteger(sessionsPerMonth) || sessionsPerMonth < 1) {
    errors.sessionsPerMonth = 'Informe um número inteiro de sessões por mês (mínimo 1).';
  }

  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      phone,
      agreement: { type: value.type, amount, sessionsPerMonth, chargeNoShow: value.chargeNoShow },
    },
  };
}
