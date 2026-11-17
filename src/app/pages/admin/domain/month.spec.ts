import { currentMonth, isValidMonth, monthLabel, monthWindow, shiftMonth } from './month';

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

describe('shiftMonth', () => {
  it('soma meses dentro do ano', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-11', -5)).toBe('2026-06');
    expect(shiftMonth('2026-11', 0)).toBe('2026-11');
  });

  it('atravessa a virada do ano nos dois sentidos', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('lança para mês inválido', () => {
    for (const bad of ['', '2026-13', 'novembro']) {
      expect(() => shiftMonth(bad, 1)).toThrow();
    }
  });
});

describe('monthLabel', () => {
  it('usa abreviações fixas em português com o ano de dois dígitos', () => {
    expect(monthLabel('2026-11')).toBe('nov/26');
    expect(monthLabel('2027-01')).toBe('jan/27');
    expect(monthLabel('2026-09')).toBe('set/26');
  });

  it('lança para mês inválido', () => {
    expect(() => monthLabel('2026-13')).toThrow();
  });
});
