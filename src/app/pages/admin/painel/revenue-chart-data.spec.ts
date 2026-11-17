import { describe, expect, it } from 'vitest';

import type { DashboardPoint } from '../domain/dashboard';
import {
  revenueChartData,
  revenueChartLabel,
  revenueChartOptions,
  revenueZardChartConfig,
  revenueZardChartRows,
} from './revenue-chart-data';

const series: DashboardPoint[] = [
  { month: '2026-10', received: 0, due: 15000 },
  { month: '2026-11', received: 15000, due: 100000 },
];

const normalize = (text: string) => text.replace(/\s/g, ' ');

describe('revenueChartData', () => {
  it('usa rótulos curtos de mês', () => {
    expect(revenueChartData(series).labels).toEqual(['out/26', 'nov/26']);
  });

  it('converte centavos para reais e mantém a ordem Recebido, Devido', () => {
    const { datasets } = revenueChartData(series);

    expect(datasets[0].label).toBe('Recebido');
    expect(datasets[0].data).toEqual([0, 150]);
    expect(datasets[1].label).toBe('Devido');
    expect(datasets[1].data).toEqual([150, 1000]);
  });

  it('usa as cores da paleta', () => {
    const { datasets } = revenueChartData(series);

    expect(datasets[0].backgroundColor).toBe('#4D6D66');
    expect(datasets[1].backgroundColor).toBe('#D4E6E1');
  });

  it('mês sem movimento fica com barra zero', () => {
    const { datasets } = revenueChartData([{ month: '2027-01', received: 0, due: 0 }]);

    expect(datasets[0].data).toEqual([0]);
    expect(datasets[1].data).toEqual([0]);
  });
});

describe('revenueChartOptions', () => {
  it('tooltip e eixo Y formatam em reais', () => {
    const options = revenueChartOptions();
    const label = options.plugins?.tooltip?.callbacks?.label as (context: unknown) => string;
    const tick = options.scales?.['y']?.ticks?.callback as (value: number) => string;

    expect(normalize(label({ dataset: { label: 'Recebido' }, parsed: { y: 150 } }))).toBe(
      'Recebido: R$ 150,00',
    );
    expect(normalize(tick(150))).toBe('R$ 150,00');
  });
});

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
    expect(revenueZardChartConfig['received'].label).toBe('Recebido');
    expect(revenueZardChartConfig['due'].label).toBe('Devido');
  });
});
