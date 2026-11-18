import type { ZardChartConfig, ZardChartDatum } from '@/shared/components/chart';
import type { DashboardPoint } from '../domain/dashboard';
import { monthLabel } from '../domain/month';

const RECEIVED_COLOR = '#4D6D66';

export interface RevenueChartRow extends ZardChartDatum {
  month: string;
  received: number;
  due: number;
}

export const revenueZardChartConfig: ZardChartConfig = {
  received: { label: 'Recebido', color: RECEIVED_COLOR },
  due: { label: 'Devido', color: DUE_COLOR },
};

export function revenueZardChartRows(series: DashboardPoint[]): RevenueChartRow[] {
  return series.map(point => ({
    month: monthLabel(point.month),
    received: point.received / 100,
    due: point.due / 100,
  }));
}

export function revenueChartLabel(series: DashboardPoint[]): string {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) return 'Gráfico de barras sem dados';
  return `Gráfico de barras com o recebido e o devido de ${monthLabel(first.month)} a ${monthLabel(last.month)}`;
}
