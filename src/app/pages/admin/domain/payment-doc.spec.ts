import { paymentFromDoc, paymentToDoc } from './payment-doc';
import type { PaymentInput } from './payment-form';

const input: PaymentInput = {
  patientId: 'p1',
  amount: 15050,
  paidAt: '2026-11-27',
  referenceMonth: '2026-11',
  note: 'Pix da Ana',
};

describe('paymentToDoc e paymentFromDoc', () => {
  it('ida e volta preserva os valores reais e o id do documento', () => {
    expect(paymentFromDoc('x1', paymentToDoc(input))).toEqual({ id: 'x1', ...input });
  });

  it('grava só os campos do pagamento, sem id', () => {
    expect(paymentToDoc(input)).toEqual({
      patientId: 'p1',
      amount: 15050,
      paidAt: '2026-11-27',
      referenceMonth: '2026-11',
      note: 'Pix da Ana',
    });
  });

  it('campos ausentes viram amount 0 e note vazio', () => {
    expect(paymentFromDoc('x2', { patientId: 'p1', paidAt: '2026-11-27', referenceMonth: '2026-11' })).toEqual({
      id: 'x2',
      patientId: 'p1',
      amount: 0,
      paidAt: '2026-11-27',
      referenceMonth: '2026-11',
      note: '',
    });
  });
});
