import type { Session } from './models';
import { canConfirm, formatSessionDateTime, groupSessions, statusLabel } from './sessions-view';

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

    const { pending } = groupSessions(
      [pastScheduled, futureScheduled, pastDone, pastNoShow, pastCancelled, pastNoPatient],
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
  });
});

describe('formatSessionDateTime', () => {
  it('formata data e hora em America/Sao_Paulo (UTC-3)', () => {
    const formatted = formatSessionDateTime(new Date('2026-11-10T17:30:00.000Z'));
    expect(formatted).toContain('10/11/2026');
    expect(formatted).toContain('14:30');
  });
});
