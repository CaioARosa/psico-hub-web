import type { Payment } from './models';

export interface PaymentFilters {
  /** `YYYY-MM`; vazio significa todos os meses. */
  month: string;
  /** Id do paciente; vazio significa todos os pacientes. */
  patientId: string;
}

export function filterPayments(payments: Payment[], filters: PaymentFilters): Payment[] {
  return payments.filter(
    payment =>
      (filters.month === '' || payment.referenceMonth === filters.month) &&
      (filters.patientId === '' || payment.patientId === filters.patientId),
  );
}

/** `2026-11-27` → `27/11/2026`. */
export function formatPaidAt(paidAt: string): string {
  const [year, month, day] = paidAt.split('-');
  return `${day}/${month}/${year}`;
}

/** `2026-11` → `11/2026`. */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${monthNumber}/${year}`;
}
