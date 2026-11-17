import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ZardChartImports } from '@/shared/components/chart';
import type { DashboardPoint } from '../domain/dashboard';
import { formatCents } from '../domain/money';
import {
  revenueChartLabel,
  revenueZardChartConfig,
  revenueZardChartRows,
} from './revenue-chart-data';

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [...ZardChartImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full" [attr.aria-label]="label()">
      <z-chart
        zType="bar"
        [zData]="rows()"
        [zConfig]="chartConfig"
        [zSeries]="chartSeries"
        zXAxisKey="month"
        [zYAxis]="true"
        [zYAxisFormatter]="formatCurrency"
        [zLazyRender]="false"
        class="h-64 w-full"
      >
        <z-chart-tooltip zIndicator="dot" [zValueFormatter]="formatTooltipValue" />
        <z-chart-legend zVerticalAlign="bottom" />
      </z-chart>
    </div>
  `,
})
export class RevenueChartComponent {
  readonly series = input.required<DashboardPoint[]>();

  protected readonly chartConfig = revenueZardChartConfig;
  protected readonly chartSeries = ['received', 'due'] as const;
  protected readonly rows = computed(() => revenueZardChartRows(this.series()));
  protected readonly label = computed(() => revenueChartLabel(this.series()));

  protected readonly formatCurrency = (value: number): string => formatCents(Math.round(value * 100));
  protected readonly formatTooltipValue = (value: number): string => formatCents(Math.round(value * 100));
}
