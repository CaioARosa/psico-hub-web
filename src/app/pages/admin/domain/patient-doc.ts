import type { AgreementType, Patient } from './models';
import type { PatientInput } from './patient-form';

/** Formato do documento em `patients`: valor em centavos e sessões como inteiros. */
export interface PatientDoc {
  name: string;
  phone: string;
  active: boolean;
  agreement: {
    type: AgreementType;
    amount: number;
    sessionsPerMonth: number;
    chargeNoShow: boolean;
  };
}

export function patientFromDoc(id: string, data: Record<string, any>): Patient {
  const agreement = data['agreement'] ?? {};
  return {
    id,
    name: String(data['name'] ?? ''),
    phone: String(data['phone'] ?? ''),
    active: data['active'] !== false,
    agreement: {
      type: agreement.type === 'monthly_package' ? 'monthly_package' : 'per_session',
      amount: Number(agreement.amount ?? 0),
      sessionsPerMonth: Number(agreement.sessionsPerMonth ?? 1),
      chargeNoShow: agreement.chargeNoShow === true,
    },
  };
}

export function newPatientDoc(input: PatientInput): PatientDoc {
  return { ...patientToDoc(input), active: true };
}

export function patientToDoc(input: PatientInput): Omit<PatientDoc, 'active'> {
  return {
    name: input.name,
    phone: input.phone,
    agreement: {
      type: input.agreement.type,
      amount: input.agreement.amount,
      sessionsPerMonth: input.agreement.sessionsPerMonth,
      chargeNoShow: input.agreement.chargeNoShow,
    },
  };
}
