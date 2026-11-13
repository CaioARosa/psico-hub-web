import type { Payment } from './models';
import type { PaymentInput } from './payment-form';

/** Formato do documento em `payments`: valor em centavos, datas como texto. */
export interface PaymentDoc {
  patientId: string;
  amount: number;
  paidAt: string;
  referenceMonth: string;
  note: string;
}

export function paymentFromDoc(id: string, data: Record<string, any>): Payment {
  return {
    id,
    patientId: String(data['patientId'] ?? ''),
    amount: Number(data['amount'] ?? 0),
    paidAt: String(data['paidAt'] ?? ''),
    referenceMonth: String(data['referenceMonth'] ?? ''),
    note: String(data['note'] ?? ''),
  };
}

export function paymentToDoc(input: PaymentInput): PaymentDoc {
  return {
    patientId: input.patientId,
    amount: input.amount,
    paidAt: input.paidAt,
    referenceMonth: input.referenceMonth,
    note: input.note,
  };
}
