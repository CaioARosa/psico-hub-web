import type { PatientMonthLine } from './finance';
import { totalsOf } from './finance-view';

function line(overrides: Partial<PatientMonthLine>): PatientMonthLine {
  return {
    patientId: 'p1',
    month: '2026-11',
    due: 0,
    received: 0,
    abated: 0,
    toReceive: 0,
    overdue: 0,
    credit: 0,
    sources: [],
    ...overrides,
  };
}

describe('totalsOf', () => {
  it('soma cada coluna das linhas do mês', () => {
    const lines = [
      line({ due: 30000, received: 15000, toReceive: 15000, overdue: 15000 }),
      line({ patientId: 'p2', due: 60000, toReceive: 60000 }),
      line({ patientId: 'p3', abated: 5000 }),
      line({ patientId: 'gone', received: 20000, credit: 20000 }),
    ];

    expect(totalsOf(lines)).toEqual({
      due: 90000,
      received: 35000,
      abated: 5000,
      toReceive: 75000,
      overdue: 15000,
      credit: 20000,
    });
  });

  it('sem linhas, todas as colunas são zero', () => {
    expect(totalsOf([])).toEqual({
      due: 0,
      received: 0,
      abated: 0,
      toReceive: 0,
      overdue: 0,
      credit: 0,
    });
  });
});
