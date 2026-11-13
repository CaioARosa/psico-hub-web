import { filterPayments, formatMonth, formatPaidAt } from './payments-view';
import type { Payment } from './models';

const payments: Payment[] = [
  { id: 'a', patientId: 'p1', amount: 15000, paidAt: '2026-12-02', referenceMonth: '2026-12', note: '' },
  { id: 'b', patientId: 'p2', amount: 20000, paidAt: '2026-11-28', referenceMonth: '2026-11', note: '' },
  { id: 'c', patientId: 'p1', amount: 15000, paidAt: '2026-11-05', referenceMonth: '2026-11', note: 'Ana' },
  { id: 'd', patientId: 'p2', amount: 20000, paidAt: '2026-10-30', referenceMonth: '2026-10', note: '' },
];

const ids = (list: Payment[]) => list.map(payment => payment.id);

describe('filterPayments', () => {
  it('sem filtro devolve todos, na ordem recebida', () => {
    expect(ids(filterPayments(payments, { month: '', patientId: '' }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filtra pelo mês de referência', () => {
    expect(ids(filterPayments(payments, { month: '2026-11', patientId: '' }))).toEqual(['b', 'c']);
  });

  it('filtra pelo paciente', () => {
    expect(ids(filterPayments(payments, { month: '', patientId: 'p2' }))).toEqual(['b', 'd']);
  });

  it('combina os dois filtros', () => {
    expect(ids(filterPayments(payments, { month: '2026-11', patientId: 'p1' }))).toEqual(['c']);
  });

  it('devolve lista vazia quando nada corresponde', () => {
    expect(filterPayments(payments, { month: '2026-01', patientId: '' })).toEqual([]);
  });
});

describe('formatPaidAt e formatMonth', () => {
  it('mostram a data no formato brasileiro', () => {
    expect(formatPaidAt('2026-11-27')).toBe('27/11/2026');
    expect(formatMonth('2026-11')).toBe('11/2026');
  });
});
