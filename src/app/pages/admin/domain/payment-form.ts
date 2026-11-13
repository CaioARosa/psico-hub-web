import { isValidMonth } from './month';
import type { Payment } from './models';
import { centsToInput, parseBRLToCents } from './money';

export interface PaymentFormValue {
  patientId: string;
  amount: string;
  paidAt: string;
  referenceMonth: string;
  note: string;
}

export type PaymentInput = Omit<Payment, 'id'>;
export type PaymentFormField = 'patientId' | 'amount' | 'paidAt' | 'referenceMonth';
export type PaymentFormErrors = Partial<Record<PaymentFormField, string>>;

export type PaymentInputResult =
  | { ok: true; value: PaymentInput }
  | { ok: false; errors: PaymentFormErrors };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

export function toPaymentInput(value: PaymentFormValue): PaymentInputResult {
  const errors: PaymentFormErrors = {};

  const patientId = value.patientId.trim();
  if (patientId === '') errors.patientId = 'Escolha o paciente.';

  const amount = parseBRLToCents(value.amount);
  if (amount === null) errors.amount = 'Valor inválido. Use o formato 150,00.';
  else if (amount === 0) errors.amount = 'O valor deve ser maior que zero.';

  const paidAt = value.paidAt.trim();
  if (paidAt === '') errors.paidAt = 'Informe a data do Pix.';
  else if (!isValidIsoDate(paidAt)) errors.paidAt = 'Data inválida. Use uma data real no formato AAAA-MM-DD.';

  const referenceMonth = value.referenceMonth.trim();
  if (referenceMonth === '') errors.referenceMonth = 'Informe o mês de referência.';
  else if (!isValidMonth(referenceMonth)) errors.referenceMonth = 'Mês inválido. Use o formato AAAA-MM.';

  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };

  return {
    ok: true,
    value: { patientId, amount, paidAt, referenceMonth, note: value.note.trim() },
  };
}

export function paymentToFormValue(payment: Payment): PaymentFormValue {
  return {
    patientId: payment.patientId,
    amount: centsToInput(payment.amount),
    paidAt: payment.paidAt,
    referenceMonth: payment.referenceMonth,
    note: payment.note,
  };
}

/** Data real no formato `YYYY-MM-DD`; `setUTCFullYear` evita o mapeamento de anos 0–99 do `Date.UTC`. */
export function isValidIsoDate(text: string): boolean {
  if (!ISO_DATE.test(text)) return false;
  const year = Number(text.slice(0, 4));
  const monthIndex = Number(text.slice(5, 7)) - 1;
  const day = Number(text.slice(8, 10));
  const date = new Date(0);
  date.setUTCFullYear(year, monthIndex, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex && date.getUTCDate() === day;
}

/** Mês de referência padrão: o mês da data do Pix, ou vazio se a data não é válida. */
export function referenceMonthOf(paidAt: string): string {
  return isValidIsoDate(paidAt) ? paidAt.slice(0, 7) : '';
}

/** Data de hoje em UTC-3 (`YYYY-MM-DD`). */
export function todayIso(now: Date): string {
  return new Date(now.getTime() - UTC_OFFSET_MS).toISOString().slice(0, 10);
}
