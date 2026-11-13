import type { Patient, SessionStatus } from './models';

/** Campos gravados junto com a mudança de status; "Faltou" guarda o "cobrar faltas" vigente. */
export function sessionStatusUpdate(
  status: Exclude<SessionStatus, 'scheduled'>,
  patient: Patient,
): Record<string, unknown> {
  if (status === 'no_show') return { status, chargeNoShowApplied: patient.agreement.chargeNoShow };
  return { status };
}
