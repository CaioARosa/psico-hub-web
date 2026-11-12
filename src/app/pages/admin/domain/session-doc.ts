import type { Session, SessionStatus } from './models';

const STATUSES: readonly SessionStatus[] = ['scheduled', 'done', 'no_show', 'cancelled'];

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate();
  }
  return new Date(0);
}

export function sessionFromDoc(id: string, data: Record<string, any>): Session {
  const status = STATUSES.find(s => s === data['status']) ?? 'scheduled';
  return {
    id,
    patientId: typeof data['patientId'] === 'string' && data['patientId'] !== '' ? data['patientId'] : null,
    startsAt: toDate(data['startsAt']),
    calendarTitle: String(data['calendarTitle'] ?? ''),
    status,
    amountApplied: Number(data['amountApplied'] ?? 0),
    missingFromCalendar: data['missingFromCalendar'] === true,
  };
}
