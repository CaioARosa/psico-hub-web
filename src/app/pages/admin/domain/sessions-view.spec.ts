import type { Session } from './models';
import {
  canConfirm,
  canReschedule,
  formatSessionDateTime,
  formatShortDateTime,
  groupSessions,
  rescheduleNote,
  statusLabel,
} from './sessions-view';

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-10T13:00:00.000Z'),
    calendarTitle: 'Consulta [Individual] - Ana',
    status: 'scheduled',
    amountApplied: 0,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
    rescheduledToId: null,
    rescheduledToStartsAt: null,
    statusBeforeReschedule: null,
    rescheduledFromId: null,
    rescheduledFromStartsAt: null,
    ...overrides,
  };
}

const now = new Date('2026-11-12T12:00:00.000Z');

describe('groupSessions', () => {
  it('all vem ordenado por data', () => {
    const late = session({ id: 'late', startsAt: new Date('2026-11-20T13:00:00.000Z') });
    const early = session({ id: 'early', startsAt: new Date('2026-11-02T13:00:00.000Z') });
    const mid = session({ id: 'mid', startsAt: new Date('2026-11-10T13:00:00.000Z') });
    const input = [late, early, mid];

    expect(groupSessions(input, now).all.map(s => s.id)).toEqual(['early', 'mid', 'late']);
    expect(input.map(s => s.id)).toEqual(['late', 'early', 'mid']);
  });

  it('pending só inclui scheduled passadas com paciente', () => {
    const pastScheduled = session({ id: 'a' });
    const futureScheduled = session({ id: 'b', startsAt: new Date('2026-11-20T13:00:00.000Z') });
    const pastDone = session({ id: 'c', status: 'done' });
    const pastNoShow = session({ id: 'd', status: 'no_show' });
    const pastCancelled = session({ id: 'e', status: 'cancelled' });
    const pastNoPatient = session({ id: 'f', patientId: null });
    const pastRescheduled = session({ id: 'g', status: 'rescheduled' });

    const { pending } = groupSessions(
      [
        pastScheduled,
        futureScheduled,
        pastDone,
        pastNoShow,
        pastCancelled,
        pastNoPatient,
        pastRescheduled,
      ],
      now,
    );

    expect(pending.map(s => s.id)).toEqual(['a']);
  });

  it('unidentified inclui sessões sem paciente de qualquer status', () => {
    const a = session({ id: 'a', patientId: null, status: 'scheduled' });
    const b = session({ id: 'b', patientId: null, status: 'done' });
    const c = session({ id: 'c', patientId: null, status: 'cancelled' });
    const d = session({ id: 'd', patientId: 'p2' });

    expect(groupSessions([a, b, c, d], now).unidentified.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('canConfirm', () => {
  it('é false sem paciente e true com paciente', () => {
    expect(canConfirm(session({ id: 'a', patientId: null }))).toBe(false);
    expect(canConfirm(session({ id: 'b', patientId: 'p1' }))).toBe(true);
  });
});

describe('statusLabel', () => {
  it('traduz todos os status para PT-BR', () => {
    expect(statusLabel('scheduled')).toBe('Agendada');
    expect(statusLabel('done')).toBe('Realizada');
    expect(statusLabel('no_show')).toBe('Faltou');
    expect(statusLabel('cancelled')).toBe('Cancelada');
    expect(statusLabel('rescheduled')).toBe('Reagendada');
  });
});

describe('canReschedule', () => {
  it('é true para agendada, falta e cancelada com paciente', () => {
    expect(canReschedule(session({ id: 'a', status: 'scheduled' }))).toBe(true);
    expect(canReschedule(session({ id: 'b', status: 'no_show' }))).toBe(true);
    expect(canReschedule(session({ id: 'c', status: 'cancelled' }))).toBe(true);
  });

  it('é false para realizada, já reagendada e sem paciente', () => {
    expect(canReschedule(session({ id: 'a', status: 'done' }))).toBe(false);
    expect(canReschedule(session({ id: 'b', status: 'rescheduled' }))).toBe(false);
    expect(canReschedule(session({ id: 'c', patientId: null }))).toBe(false);
  });
});

describe('formatShortDateTime', () => {
  it('formata dia da semana, dia/mês abreviado e hora em UTC-3', () => {
    expect(formatShortDateTime(new Date('2026-11-26T23:00:00.000Z'))).toBe('qui, 26/nov, 20:00');
    expect(formatShortDateTime(new Date('2026-11-23T22:00:00.000Z'))).toBe('seg, 23/nov, 19:00');
  });

  it('vira o dia pela data em UTC-3', () => {
    expect(formatShortDateTime(new Date('2026-12-01T02:30:00.000Z'))).toBe('seg, 30/nov, 23:30');
    expect(formatShortDateTime(new Date('2026-01-04T12:05:00.000Z'))).toBe('dom, 04/jan, 09:05');
  });
});

describe('rescheduleNote', () => {
  const to = new Date('2026-11-26T23:00:00.000Z');

  it('na original, mostra o novo horário', () => {
    const original = session({
      id: 'a',
      status: 'rescheduled',
      rescheduledToStartsAt: to,
      statusBeforeReschedule: 'scheduled',
    });
    expect(rescheduleNote(original)).toBe('Reagendada para qui, 26/nov, 20:00');
  });

  it('na original vinda de falta ou cancelamento, mostra o status anterior', () => {
    const noShow = session({
      id: 'a',
      status: 'rescheduled',
      rescheduledToStartsAt: to,
      statusBeforeReschedule: 'no_show',
    });
    const cancelled = session({
      id: 'b',
      status: 'rescheduled',
      rescheduledToStartsAt: to,
      statusBeforeReschedule: 'cancelled',
    });
    expect(rescheduleNote(noShow)).toBe('Reagendada para qui, 26/nov, 20:00 (era Faltou)');
    expect(rescheduleNote(cancelled)).toBe('Reagendada para qui, 26/nov, 20:00 (era Cancelada)');
  });

  it('na nova, mostra o horário de origem', () => {
    const created = session({
      id: 'n',
      status: 'scheduled',
      rescheduledFromStartsAt: new Date('2026-11-23T22:00:00.000Z'),
    });
    expect(rescheduleNote(created)).toBe('Reagendada de seg, 23/nov, 19:00');
  });

  it('sem campos de reagendamento é null', () => {
    expect(rescheduleNote(session({ id: 'a' }))).toBeNull();
  });
});

describe('formatSessionDateTime', () => {
  it('formata data e hora em America/Sao_Paulo (UTC-3)', () => {
    const formatted = formatSessionDateTime(new Date('2026-11-10T17:30:00.000Z'));
    expect(formatted).toContain('10/11/2026');
    expect(formatted).toContain('14:30');
  });
});
