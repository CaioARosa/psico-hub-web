import { pricingForAgreement } from './money';
import type { ConfirmableStatus, Patient, Session } from './models';

/** Campos gravados junto com a mudança de status; "Faltou" guarda o "cobrar faltas" vigente. */
export function sessionStatusUpdate(
  status: ConfirmableStatus,
  patient: Patient,
): Record<string, unknown> {
  if (status === 'no_show') return { status, chargeNoShowApplied: patient.agreement.chargeNoShow };
  return { status };
}

/** Campos gravados ao trocar o paciente: preço do novo acordo e, em "Faltou", o "cobrar faltas" dele. */
export function patientChangeUpdate(session: Session, patient: Patient): Record<string, unknown> {
  const update: Record<string, unknown> = {
    patientId: patient.id,
    ...pricingForAgreement(patient.agreement),
  };
  if (session.status === 'no_show') update['chargeNoShowApplied'] = patient.agreement.chargeNoShow;
  return update;
}
