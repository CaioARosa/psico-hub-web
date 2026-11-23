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
      packageAmountApplied: null,
      chargeNoShowApplied: null,
      missingFromCalendar: true,
      rescheduledToId: null,
      rescheduledToStartsAt: null,
      statusBeforeReschedule: null,
      rescheduledFromId: null,
      rescheduledFromStartsAt: null,
    });
  });

  it('lê status rescheduled e os campos de reagendamento', () => {
    const to = new Date('2026-11-26T23:00:00Z');
    const session = sessionFromDoc('x', {
      status: 'rescheduled',
      rescheduledToId: 'n1',
      rescheduledToStartsAt: to,
      statusBeforeReschedule: 'no_show',
    });
    expect(session.status).toBe('rescheduled');
    expect(session.rescheduledToId).toBe('n1');
    expect(session.rescheduledToStartsAt).toBe(to);
    expect(session.statusBeforeReschedule).toBe('no_show');
    expect(session.rescheduledFromId).toBeNull();
    expect(session.rescheduledFromStartsAt).toBeNull();
  });

  it('lê a origem do reagendamento a partir de Timestamp', () => {
    const session = sessionFromDoc('n1', {
      rescheduledFromId: 'x',
      rescheduledFromStartsAt: timestamp,
    });
    expect(session.rescheduledFromId).toBe('x');
    expect(session.rescheduledFromStartsAt).toBe(date);
  });

  it('campos de reagendamento ausentes ou inválidos viram null', () => {
    const absent = sessionFromDoc('x', {});
    expect(absent.rescheduledToId).toBeNull();
    expect(absent.rescheduledToStartsAt).toBeNull();
    expect(absent.statusBeforeReschedule).toBeNull();
    expect(absent.rescheduledFromId).toBeNull();
    expect(absent.rescheduledFromStartsAt).toBeNull();

    const invalid = sessionFromDoc('x', {
      rescheduledToId: 42,
      rescheduledToStartsAt: 'texto',
      statusBeforeReschedule: 'done',
      rescheduledFromId: '',
      rescheduledFromStartsAt: 123,
    });
    expect(invalid.rescheduledToId).toBeNull();
    expect(invalid.rescheduledToStartsAt).toBeNull();
    expect(invalid.statusBeforeReschedule).toBeNull();
    expect(invalid.rescheduledFromId).toBeNull();
    expect(invalid.rescheduledFromStartsAt).toBeNull();
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

  it('mapeia valores congelados ausentes para null (sessão anterior à Fase 2)', () => {
    const session = sessionFromDoc('x', { amountApplied: 15000, status: 'no_show' });
    expect(session.packageAmountApplied).toBeNull();
    expect(session.chargeNoShowApplied).toBeNull();
  });

  it('lê os valores congelados quando presentes', () => {
    const session = sessionFromDoc('y', {
      packageAmountApplied: 60000,
      chargeNoShowApplied: true,
    });
    expect(session.packageAmountApplied).toBe(60000);
    expect(session.chargeNoShowApplied).toBe(true);
  });

  it('preserva chargeNoShowApplied false (não confunde com ausente)', () => {
    expect(sessionFromDoc('z', { chargeNoShowApplied: false }).chargeNoShowApplied).toBe(false);
  });

  it('aceita startsAt já como Date e ignora status desconhecido', () => {
    const session = sessionFromDoc('y', { startsAt: date, status: 'weird', patientId: '' });
    expect(session.startsAt).toBe(date);
    expect(session.status).toBe('scheduled');
    expect(session.patientId).toBeNull();
  });
});
