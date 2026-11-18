import { describe, expect, it } from 'vitest';

import type { DashboardPoint } from '../domain/dashboard';
import { revenueChartLabel, revenueZardChartConfig, revenueZardChartRows } from './revenue-chart-data';

const series: DashboardPoint[] = [
  { month: '2026-10', received: 0, due: 15000 },
  { month: '2026-11', received: 15000, due: 100000 },
];

describe('revenueChartLabel', () => {
  it('aria-label cita o primeiro e o último mês', () => {
    expect(revenueChartLabel(series)).toBe(
      'Gráfico de barras com o recebido e o devido de out/26 a nov/26',
    );
    expect(revenueChartLabel([])).toBe('Gráfico de barras sem dados');
  });
});

describe('revenueZardChartRows', () => {
  it('prepara linhas em reais para o ZardChart mantendo rótulos de mês e configuração', () => {
    expect(revenueZardChartRows(series)).toEqual([
      { month: 'out/26', received: 0, due: 150 },
      { month: 'nov/26', received: 150, due: 1000 },
    ]);
    expect(revenueZardChartRows([{ month: '2027-01', received: 0, due: 0 }])).toEqual([
      { month: 'jan/27', received: 0, due: 0 },
    ]);
    expect(revenueZardChartConfig['received'].label).toBe('Recebido');
    expect(revenueZardChartConfig['due'].label).toBe('Devido');
  });
});
