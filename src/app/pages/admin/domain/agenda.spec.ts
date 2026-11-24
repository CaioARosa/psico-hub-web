import type { Session } from './models';
import { groupByDay, monthsInWindow, shiftWeek, weekLabel, weekWindow } from './agenda';

function makeSession(overrides: Partial<Session> & { id: string; startsAt: Date }): Session {
  return {
    patientId: 'p1',
    calendarTitle: 'Consulta - Ana Paula',
    status: 'scheduled',
    amountApplied: 15000,
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

describe('agenda domain', () => {
  it('calcula weekWindow de segunda 00:00 a segunda 00:00 em UTC-3', () => {
    const wed = weekWindow(new Date('2026-11-25T15:00:00.000Z'));
    expect(wed.start.toISOString()).toBe('2026-11-23T03:00:00.000Z');
    expect(wed.end.toISOString()).toBe('2026-11-30T03:00:00.000Z');

    // Domingo 29/11 às 23:00 BRT = 2026-11-30T02:00:00Z -> mesma semana
    const sunLate = weekWindow(new Date('2026-11-30T02:00:00.000Z'));
    expect(sunLate.start.toISOString()).toBe('2026-11-23T03:00:00.000Z');
    expect(sunLate.end.toISOString()).toBe('2026-11-30T03:00:00.000Z');

    // Virada de ano
    const newYear = weekWindow(new Date('2027-01-01T12:00:00.000Z'));
    expect(newYear.start.toISOString()).toBe('2026-12-28T03:00:00.000Z');
    expect(newYear.end.toISOString()).toBe('2027-01-04T03:00:00.000Z');
  });

  it('shiftWeek avança e recua semanas inteiras', () => {
    const start = new Date('2026-11-23T03:00:00.000Z');
    expect(shiftWeek(start, 1).toISOString()).toBe('2026-11-30T03:00:00.000Z');
    expect(shiftWeek(start, -1).toISOString()).toBe('2026-11-16T03:00:00.000Z');
  });

  it('monthsInWindow devolve 1 mês ou 2 meses quando a semana cruza virada', () => {
    const singleMonth = weekWindow(new Date('2026-11-25T15:00:00.000Z'));
    expect(monthsInWindow(singleMonth)).toEqual(['2026-11']);

    const crossYear = weekWindow(new Date('2027-01-01T12:00:00.000Z'));
    expect(monthsInWindow(crossYear)).toEqual(['2026-12', '2027-01']);
  });

  it('weekLabel formata semana no mesmo mês, cruzando mês e cruzando ano', () => {
    expect(weekLabel(weekWindow(new Date('2026-11-25T15:00:00.000Z')))).toBe('23 – 29 nov 2026');
    expect(weekLabel(weekWindow(new Date('2026-12-02T15:00:00.000Z')))).toBe(
      '30 nov – 6 dez 2026',
    );
    expect(weekLabel(weekWindow(new Date('2027-01-01T12:00:00.000Z')))).toBe(
      '28 dez 2026 – 3 jan 2027',
    );
  });

  it('groupByDay ordena por hora, omite dias vazios, marca isToday e ignora fora da janela', () => {
    const window = weekWindow(new Date('2026-11-25T15:00:00.000Z'));
    const now = new Date('2026-11-23T14:00:00.000Z'); // seg, 23/nov
    const sessions: Session[] = [
      makeSession({ id: 'before', startsAt: new Date('2026-11-23T02:59:00.000Z') }),
      makeSession({ id: 'tue-1', startsAt: new Date('2026-11-24T17:00:00.000Z') }),
      makeSession({ id: 'mon-2', startsAt: new Date('2026-11-23T22:00:00.000Z') }),
      makeSession({ id: 'mon-1', startsAt: new Date('2026-11-23T13:00:00.000Z') }),
      makeSession({ id: 'after', startsAt: new Date('2026-11-30T03:00:00.000Z') }),
    ];

    const days = groupByDay(sessions, window, now);
    expect(days).toEqual([
      {
        dayKey: '2026-11-23',
        label: 'Hoje · seg, 23/nov',
        isToday: true,
        sessions: [sessions[3], sessions[2]],
      },
      {
        dayKey: '2026-11-24',
        label: 'ter, 24/nov',
        isToday: false,
        sessions: [sessions[1]],
      },
    ]);
  });
});
