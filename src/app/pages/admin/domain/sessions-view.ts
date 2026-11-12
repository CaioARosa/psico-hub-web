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
};

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

export function statusLabel(status: SessionStatus): string {
  return STATUS_LABELS[status];
}

export function formatSessionDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
