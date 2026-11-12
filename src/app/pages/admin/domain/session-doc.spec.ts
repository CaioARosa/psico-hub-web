import { sessionFromDoc } from './session-doc';

const date = new Date('2026-11-10T13:00:00.000Z');
const timestamp = { toDate: () => date };

describe('sessionFromDoc', () => {
  it('monta a Session convertendo Timestamp em Date', () => {
    expect(
      sessionFromDoc('evt1', {
        patientId: 'p1',
        startsAt: timestamp,
        calendarTitle: 'Consulta [Individual] - Ana',
        status: 'done',
        amountApplied: 15000,
        missingFromCalendar: true,
      }),
    ).toEqual({
      id: 'evt1',
      patientId: 'p1',
      startsAt: date,
      calendarTitle: 'Consulta [Individual] - Ana',
      status: 'done',
      amountApplied: 15000,
      missingFromCalendar: true,
    });
  });

  it('tolera campos ausentes', () => {
    const session = sessionFromDoc('x', {});
    expect(session.id).toBe('x');
    expect(session.patientId).toBeNull();
    expect(session.calendarTitle).toBe('');
    expect(session.status).toBe('scheduled');
    expect(session.amountApplied).toBe(0);
    expect(session.missingFromCalendar).toBe(false);
    expect(session.startsAt).toBeInstanceOf(Date);
  });

  it('aceita startsAt já como Date e ignora status desconhecido', () => {
    const session = sessionFromDoc('y', { startsAt: date, status: 'weird', patientId: '' });
    expect(session.startsAt).toBe(date);
    expect(session.status).toBe('scheduled');
    expect(session.patientId).toBeNull();
  });
});
