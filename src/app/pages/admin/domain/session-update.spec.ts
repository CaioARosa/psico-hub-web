import { patientChangeUpdate, sessionStatusUpdate } from './session-update';
import type { Patient, Session } from './models';

function patient(chargeNoShow: boolean): Patient {
  return {
    id: 'p1',
    name: 'Ana Paula',
    phone: '11999999999',
    active: true,
    agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow },
  };
}

describe('sessionStatusUpdate', () => {
  it('falta com cobrar faltas grava chargeNoShowApplied true', () => {
    expect(sessionStatusUpdate('no_show', patient(true))).toEqual({
      status: 'no_show',
      chargeNoShowApplied: true,
    });
  });

  it('falta sem cobrar faltas grava chargeNoShowApplied false', () => {
    expect(sessionStatusUpdate('no_show', patient(false))).toEqual({
      status: 'no_show',
      chargeNoShowApplied: false,
    });
  });

  it('realizada grava só o status', () => {
    const update = sessionStatusUpdate('done', patient(true));
    expect(update).toEqual({ status: 'done' });
    expect('chargeNoShowApplied' in update).toBe(false);
  });

  it('cancelada grava só o status', () => {
    const update = sessionStatusUpdate('cancelled', patient(true));
    expect(update).toEqual({ status: 'cancelled' });
    expect('chargeNoShowApplied' in update).toBe(false);
  });
});

function session(status: Session['status']): Session {
  return {
    id: 's1',
    patientId: 'p-old',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
    calendarTitle: 'Psicoterapia Ana',
    status,
    amountApplied: 9000,
    packageAmountApplied: 0,
    chargeNoShowApplied: status === 'no_show' ? false : null,
    missingFromCalendar: false,
    rescheduledToId: null,
    rescheduledToStartsAt: null,
    statusBeforeReschedule: null,
    rescheduledFromId: null,
    rescheduledFromStartsAt: null,
  };
}

const packagePatient: Patient = {
  id: 'p-pkg',
  name: 'Bruno Pacote',
  phone: '11988888888',
  active: true,
  agreement: { type: 'monthly_package', amount: 48000, sessionsPerMonth: 4, chargeNoShow: true },
};

describe('patientChangeUpdate', () => {
  it('sessão por sessão recebe o paciente e o valor do novo acordo', () => {
    expect(patientChangeUpdate(session('scheduled'), patient(true))).toEqual({
      patientId: 'p1',
      amountApplied: 15000,
      packageAmountApplied: 0,
    });
  });

  it('pacote mensal grava o valor do pacote e zera o valor por sessão', () => {
    expect(patientChangeUpdate(session('done'), packagePatient)).toEqual({
      patientId: 'p-pkg',
      amountApplied: 0,
      packageAmountApplied: 48000,
    });
  });

  it('falta passa a seguir o cobrar faltas do novo paciente', () => {
    expect(patientChangeUpdate(session('no_show'), patient(true))).toMatchObject({
      patientId: 'p1',
      chargeNoShowApplied: true,
    });
    expect(patientChangeUpdate(session('no_show'), patient(false))).toMatchObject({
      chargeNoShowApplied: false,
    });
  });

  it('fora de falta não grava chargeNoShowApplied', () => {
    for (const status of ['scheduled', 'done', 'cancelled'] as const) {
      expect('chargeNoShowApplied' in patientChangeUpdate(session(status), patient(true))).toBe(false);
    }
  });
});
