import type { Agreement } from './models';

const INTEGER_PART = /^(\d+|\d{1,3}(\.\d{3})+)$/;
const DECIMAL_PART = /^\d{1,2}$/;

export function parseBRLToCents(input: string): number | null {
  const text = input.trim().replace(/^R\$\s*/, '').trim();
  if (text === '') return null;

  const parts = text.split(',');
  if (parts.length > 2) return null;

  const [integerText = '', decimalText = ''] = parts;
  if (!INTEGER_PART.test(integerText)) return null;
  if (parts.length === 2 && !DECIMAL_PART.test(decimalText)) return null;

  const reais = Number(integerText.replace(/\./g, ''));
  const centavos = Number(decimalText.padEnd(2, '0'));
  const cents = reais * 100 + centavos;
  return Number.isSafeInteger(cents) ? cents : null;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

export function amountForNewSession(agreement: Agreement | null): number {
  return agreement?.type === 'per_session' ? agreement.amount : 0;
}

export function packageAmountForNewSession(agreement: Agreement | null): number {
  return agreement?.type === 'monthly_package' ? agreement.amount : 0;
}

export function pricingForAgreement(agreement: Agreement | null): {
  amountApplied: number;
  packageAmountApplied: number;
} {
  return {
    amountApplied: amountForNewSession(agreement),
    packageAmountApplied: packageAmountForNewSession(agreement),
  };
}

/** Centavos inteiros não negativos para texto `150,50`, sem separador de milhar. */
export function centsToInput(cents: number): string {
  const digits = String(cents).padStart(3, '0');
  return `${digits.slice(0, -2)},${digits.slice(-2)}`;
}
