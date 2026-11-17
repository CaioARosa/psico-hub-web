import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { BaseChartDirective, provideCharts } from 'ng2-charts';

import type { DashboardPoint } from '../domain/dashboard';
import { revenueChartData, revenueChartLabel, revenueChartOptions } from './revenue-chart-data';

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideCharts({
      registerables: [BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip],
    }),
  ],
  template: `
    <div class="relative h-64 w-full">
      <canvas
        baseChart
        type="bar"
        role="img"
        [attr.aria-label]="label()"
        [data]="data()"
        [options]="options"
      ></canvas>
    </div>
  `,
})
export class RevenueChartComponent {
  readonly series = input.required<DashboardPoint[]>();

  protected readonly data = computed(() => revenueChartData(this.series()));
  protected readonly label = computed(() => revenueChartLabel(this.series()));
  protected readonly options = revenueChartOptions();
}
