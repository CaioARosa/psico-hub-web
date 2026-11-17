import type { ChartData, ChartOptions } from 'chart.js';

import type { ZardChartConfig, ZardChartDatum } from '@/shared/components/chart';
import type { DashboardPoint } from '../domain/dashboard';
import { monthLabel } from '../domain/month';
import { formatCents } from '../domain/money';

const RECEIVED_COLOR = '#4D6D66';
const DUE_COLOR = '#D4E6E1';

export interface RevenueChartRow extends ZardChartDatum {
  month: string;
  received: number;
  due: number;
}

export const revenueZardChartConfig: ZardChartConfig = {
  received: { label: 'Recebido', color: RECEIVED_COLOR },
  due: { label: 'Devido', color: '#BFD7D0' },
};

export function revenueZardChartRows(series: DashboardPoint[]): RevenueChartRow[] {
  return series.map(point => ({
    month: monthLabel(point.month),
    received: point.received / 100,
    due: point.due / 100,
  }));
}

export function revenueChartData(series: DashboardPoint[]): ChartData<'bar'> {
  return {
    labels: series.map(point => monthLabel(point.month)),
    datasets: [
      {
        label: 'Recebido',
        data: series.map(point => point.received / 100),
        backgroundColor: RECEIVED_COLOR,
      },
      {
        label: 'Devido',
        data: series.map(point => point.due / 100),
        backgroundColor: DUE_COLOR,
      },
    ],
  };
}

export function revenueChartOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: value => formatCents(Number(value) * 100) },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: context => `${context.dataset.label}: ${formatCents(Number(context.parsed.y) * 100)}`,
        },
      },
    },
  };
}

export function revenueChartLabel(series: DashboardPoint[]): string {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) return 'Gráfico de barras sem dados';
  return `Gráfico de barras com o recebido e o devido de ${monthLabel(first.month)} a ${monthLabel(last.month)}`;
}
