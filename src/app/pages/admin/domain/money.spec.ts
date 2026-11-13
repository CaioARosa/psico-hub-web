import {
  amountForNewSession,
  centsToInput,
  formatCents,
  packageAmountForNewSession,
  parseBRLToCents,
  pricingForAgreement,
} from './money';
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

describe('packageAmountForNewSession', () => {
  const base: Agreement = {
    type: 'monthly_package',
    amount: 60000,
    sessionsPerMonth: 4,
    chargeNoShow: false,
  };

  it('usa o valor do pacote mensal', () => {
    expect(packageAmountForNewSession(base)).toBe(60000);
  });

  it('retorna 0 para acordo por sessão', () => {
    expect(packageAmountForNewSession({ ...base, type: 'per_session', amount: 15000 })).toBe(0);
  });

  it('retorna 0 sem acordo', () => {
    expect(packageAmountForNewSession(null)).toBe(0);
  });
});

describe('pricingForAgreement', () => {
  const base: Agreement = {
    type: 'per_session',
    amount: 15000,
    sessionsPerMonth: 4,
    chargeNoShow: false,
  };

  it('por sessão: cobra o valor da sessão e nenhum pacote', () => {
    expect(pricingForAgreement(base)).toEqual({ amountApplied: 15000, packageAmountApplied: 0 });
  });

  it('pacote mensal: nenhum valor por sessão e cobra o pacote', () => {
    expect(pricingForAgreement({ ...base, type: 'monthly_package', amount: 60000 })).toEqual({
      amountApplied: 0,
      packageAmountApplied: 60000,
    });
  });

  it('sem acordo: zera os dois valores', () => {
    expect(pricingForAgreement(null)).toEqual({ amountApplied: 0, packageAmountApplied: 0 });
  });
});

describe('centsToInput', () => {
  it.each([
    [15050, '150,50'],
    [60005, '600,05'],
    [15000, '150,00'],
    [5, '0,05'],
    [0, '0,00'],
  ])('converte %i centavos para %j', (cents, expected) => {
    expect(centsToInput(cents)).toBe(expected);
  });

  it('é a inversa de parseBRLToCents', () => {
    expect(parseBRLToCents(centsToInput(60005))).toBe(60005);
  });
});
