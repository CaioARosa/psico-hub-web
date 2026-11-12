import { amountForNewSession, formatCents, parseBRLToCents } from './money';
import type { Agreement } from './models';

describe('parseBRLToCents', () => {
  it.each([
    ['150', 15000],
    ['150,5', 15050],
    ['150,50', 15050],
    ['R$ 1.500', 150000],
    ['1.500,00', 150000],
    ['1.500', 150000],
    ['  R$ 150,50  ', 15050],
    ['R$150', 15000],
    ['0,29', 29],
    ['0', 0],
    ['1.234.567,89', 123456789],
  ])('converte %j para %i centavos', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['R$'],
    ['abc'],
    ['12a'],
    ['-10'],
    ['10,999'],
    ['1,2,3'],
    [','],
    ['10,'],
    ['1.50'],
    ['1.5000'],
    ['1.2.3'],
    ['NaN'],
  ])('rejeita %j com null', (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe('formatCents', () => {
  it('formata centavos como moeda brasileira', () => {
    expect(formatCents(15000).replace(/\u00a0/g, ' ')).toBe('R$ 150,00');
    expect(formatCents(15050)).toContain('150,50');
    expect(formatCents(150000).replace(/\u00a0/g, ' ')).toBe('R$ 1.500,00');
  });
});

describe('amountForNewSession', () => {
  const base: Agreement = {
    type: 'per_session',
    amount: 15000,
    sessionsPerMonth: 4,
    chargeNoShow: false,
  };

  it('usa o valor do acordo por sessão', () => {
    expect(amountForNewSession(base)).toBe(15000);
  });

  it('retorna 0 para pacote mensal', () => {
    expect(amountForNewSession({ ...base, type: 'monthly_package', amount: 60000 })).toBe(0);
  });

  it('retorna 0 sem acordo', () => {
    expect(amountForNewSession(null)).toBe(0);
  });
});
