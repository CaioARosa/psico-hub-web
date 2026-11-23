export type AgreementType = 'per_session' | 'monthly_package';

export interface Agreement {
  type: AgreementType;
  amount: number;
  sessionsPerMonth: number;
  chargeNoShow: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  agreement: Agreement;
}

export type SessionStatus = 'scheduled' | 'done' | 'no_show' | 'cancelled' | 'rescheduled';

export type ReschedulableStatus = 'scheduled' | 'no_show' | 'cancelled';

export const RESCHEDULABLE_STATUSES: readonly ReschedulableStatus[] = [
  'scheduled',
  'no_show',
  'cancelled',
];

export interface Session {
  id: string;
  patientId: string | null;
  startsAt: Date;
  calendarTitle: string;
  status: SessionStatus;
  amountApplied: number;
  /** `null` em sessões anteriores à Fase 2 (valor de contingência; ver spec financeiro §3). */
  packageAmountApplied: number | null;
  /** `null` em sessões anteriores à Fase 2 (ou ainda não marcadas como falta). */
  chargeNoShowApplied: boolean | null;
  missingFromCalendar: boolean;
  rescheduledToId: string | null;
  rescheduledToStartsAt: Date | null;
  statusBeforeReschedule: ReschedulableStatus | null;
  rescheduledFromId: string | null;
  rescheduledFromStartsAt: Date | null;
}

export interface Payment {
  id: string;
  patientId: string;
  /** Centavos inteiros maiores que zero. */
  amount: number;
  /** `YYYY-MM-DD`. */
  paidAt: string;
  /** `YYYY-MM`. */
  referenceMonth: string;
  note: string;
}
