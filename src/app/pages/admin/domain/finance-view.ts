import type { PatientMonthLine } from './finance';

export interface LineTotals {
  due: number;
  received: number;
  abated: number;
  toReceive: number;
  overdue: number;
  credit: number;
}

/** Soma das colunas das linhas de um mês; a linha de total da tabela vem daqui, não da tela. */
export function totalsOf(lines: PatientMonthLine[]): LineTotals {
  const sum = (pick: (line: PatientMonthLine) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);
  return {
    due: sum(line => line.due),
    received: sum(line => line.received),
    abated: sum(line => line.abated),
    toReceive: sum(line => line.toReceive),
    overdue: sum(line => line.overdue),
    credit: sum(line => line.credit),
  };
}
