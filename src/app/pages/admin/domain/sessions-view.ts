import { MONTH_ABBREVIATIONS } from './month';
import type { Session, SessionStatus } from './models';

export interface SessionGroups {
  all: Session[];
  pending: Session[];
  unidentified: Session[];
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Agendada',
  done: 'Realizada',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
  rescheduled: 'Reagendada',
};

const WEEKDAY_ABBREVIATIONS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function groupSessions(sessions: Session[], now: Date): SessionGroups {
  const all = [...sessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return {
    all,
    pending: all.filter(s => s.status === 'scheduled' && s.patientId !== null && s.startsAt < now),
    unidentified: all.filter(s => s.patientId === null),
  };
}

/** Sessão sem paciente vinculado não pode ser realizada, faltar nem ser cancelada. */
export function canConfirm(session: Session): boolean {
  return session.patientId !== null;
}

export function canReschedule(session: Session): boolean {
  const { patientId, status } = session;
  return (
    patientId !== null && (status === 'scheduled' || status === 'no_show' || status === 'cancelled')
  );
}

export function rescheduleNote(session: Session): string | null {
  if (session.status === 'rescheduled' && session.rescheduledToStartsAt) {
    const previous = session.statusBeforeReschedule;
    const suffix =
      previous === 'no_show' || previous === 'cancelled' ? ` (era ${statusLabel(previous)})` : '';
    return `Reagendada para ${formatShortDateTime(session.rescheduledToStartsAt)}${suffix}`;
  }
  if (session.rescheduledFromStartsAt) {
    return `Reagendada de ${formatShortDateTime(session.rescheduledFromStartsAt)}`;
  }
  return null;
}

export function statusLabel(status: SessionStatus): string {
  return STATUS_LABELS[status];
}

export function formatSessionDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** `qui, 26/nov, 20:00` em UTC-3 fixo; abreviações fixas porque `Intl` varia com o ICU. */
export function formatShortDateTime(date: Date): string {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  const weekday = WEEKDAY_ABBREVIATIONS[local.getUTCDay()];
  const month = MONTH_ABBREVIATIONS[local.getUTCMonth()];
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  return `${weekday}, ${pad(local.getUTCDate())}/${month}, ${time}`;
}
