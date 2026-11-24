import { dateKeyOf, shortDateOf, timeOf, zonedDateTime } from './datetime';

describe('zonedDateTime', () => {
  it('interpreta data e hora em UTC-3', () => {
    expect(zonedDateTime('2026-11-26', '20:00').toISOString()).toBe('2026-11-26T23:00:00.000Z');
  });

  it('vira o dia e o ano em UTC', () => {
    expect(zonedDateTime('2026-12-31', '22:30').toISOString()).toBe('2027-01-01T01:30:00.000Z');
  });

  it('rejeita formatos inválidos', () => {
    expect(() => zonedDateTime('26/11/2026', '20:00')).toThrow();
    expect(() => zonedDateTime('2026-11-26', '8:00')).toThrow();
    expect(() => zonedDateTime('', '')).toThrow();
  });

  it('aceita 29/02 em ano bissexto e os limites do dia', () => {
    expect(zonedDateTime('2028-02-29', '10:00').toISOString()).toBe('2028-02-29T13:00:00.000Z');
    expect(zonedDateTime('2026-11-26', '00:00').toISOString()).toBe('2026-11-26T03:00:00.000Z');
    expect(zonedDateTime('2026-11-26', '23:59').toISOString()).toBe('2026-11-27T02:59:00.000Z');
  });

  it('rejeita datas e horas impossíveis', () => {
    expect(() => zonedDateTime('2027-02-29', '10:00')).toThrow();
    expect(() => zonedDateTime('2026-02-30', '10:00')).toThrow();
    expect(() => zonedDateTime('2026-13-01', '10:00')).toThrow();
    expect(() => zonedDateTime('2026-11-26', '25:00')).toThrow();
    expect(() => zonedDateTime('2026-11-26', '10:60')).toThrow();
  });
});

describe('dateKeyOf e timeOf', () => {
  it('formatam em UTC-3', () => {
    const date = new Date('2026-11-27T01:00:00Z');
    expect(dateKeyOf(date)).toBe('2026-11-26');
    expect(timeOf(date)).toBe('22:00');
  });

  it('fazem ida e volta com zonedDateTime', () => {
    const date = zonedDateTime('2027-01-01', '00:15');
    expect(dateKeyOf(date)).toBe('2027-01-01');
    expect(timeOf(date)).toBe('00:15');
  });
});

describe('shortDateOf', () => {
  it('formata dd/mm em UTC-3', () => {
    expect(shortDateOf(new Date('2026-11-20T15:00:00Z'))).toBe('20/11');
  });

  it('antes das 03:00Z ainda é o dia anterior em UTC-3', () => {
    expect(shortDateOf(new Date('2026-11-21T02:00:00Z'))).toBe('20/11');
  });
});
