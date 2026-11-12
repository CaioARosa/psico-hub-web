import { currentMonth, isValidMonth, monthWindow } from './month';

describe('isValidMonth', () => {
  it('aceita YYYY-MM válido e rejeita formatos inválidos', () => {
    expect(isValidMonth('2026-01')).toBe(true);
    expect(isValidMonth('2026-12')).toBe(true);
    expect(isValidMonth('')).toBe(false);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-1')).toBe(false);
  });
});

describe('monthWindow', () => {
  it('cobre o mês em UTC-3', () => {
    const { start, end } = monthWindow('2026-11');
    expect(start.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });

  it('dezembro vira o ano seguinte', () => {
    const { start, end } = monthWindow('2026-12');
    expect(start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('lança para mês inválido', () => {
    for (const bad of ['', '2026-13', '2026-00', '2026-1', '26-11', 'novembro', '2026-11-01']) {
      expect(() => monthWindow(bad)).toThrow();
    }
  });
});

describe('currentMonth', () => {
  it('usa UTC-3: 01/12 01:00Z ainda é novembro', () => {
    expect(currentMonth(new Date('2026-12-01T01:00:00.000Z'))).toBe('2026-11');
  });

  it('usa UTC-3: 01/12 03:00Z já é dezembro', () => {
    expect(currentMonth(new Date('2026-12-01T03:00:00.000Z'))).toBe('2026-12');
  });

  it('janeiro com zero à esquerda', () => {
    expect(currentMonth(new Date('2027-01-15T12:00:00.000Z'))).toBe('2027-01');
  });
});
