import { RESCHEDULABLE_STATUSES } from './models';
import type { Session, SessionStatus } from './models';

const STATUSES: readonly SessionStatus[] = [
  'scheduled',
  'done',
  'no_show',
  'cancelled',
  'rescheduled',
];

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate();
  }
  return null;
}

function toDate(value: unknown): Date {
  return toDateOrNull(value) ?? new Date(0);
}

function idOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

export function sessionFromDoc(id: string, data: Record<string, any>): Session {
  const status = STATUSES.find(s => s === data['status']) ?? 'scheduled';
  return {
    id,
    patientId: idOrNull(data['patientId']),
    startsAt: toDate(data['startsAt']),
    calendarTitle: String(data['calendarTitle'] ?? ''),
    status,
    amountApplied: Number(data['amountApplied'] ?? 0),
    packageAmountApplied: typeof data['packageAmountApplied'] === 'number' ? data['packageAmountApplied'] : null,
    chargeNoShowApplied: typeof data['chargeNoShowApplied'] === 'boolean' ? data['chargeNoShowApplied'] : null,
    missingFromCalendar: data['missingFromCalendar'] === true,
    rescheduledToId: idOrNull(data['rescheduledToId']),
    rescheduledToStartsAt: toDateOrNull(data['rescheduledToStartsAt']),
    statusBeforeReschedule:
      RESCHEDULABLE_STATUSES.find(s => s === data['statusBeforeReschedule']) ?? null,
    rescheduledFromId: idOrNull(data['rescheduledFromId']),
    rescheduledFromStartsAt: toDateOrNull(data['rescheduledFromStartsAt']),
  };
}
