import { sessionStatusUpdate } from './session-update';
import type { Patient } from './models';

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
