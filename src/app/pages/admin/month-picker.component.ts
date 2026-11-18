import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { CalendarValue } from '@/shared/components/calendar';
import { ZardDatePickerComponent } from '@/shared/components/date-picker';
import { isValidMonth } from './domain/month';

/** Seletor de mês sobre o date-picker do ZardUI: o valor é `YYYY-MM`; o dia escolhido é descartado. */
@Component({
  selector: 'app-month-picker',
  standalone: true,
  imports: [ZardDatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-date-picker
      [zId]="zId()"
      zLocale="pt-BR"
      zFormat="MMMM 'de' yyyy"
      [zPlaceholder]="zPlaceholder()"
      zIcon="calendar"
      [value]="date()"
      (dateChange)="onDateChange($event)"
    />
  `,
})
export class MonthPickerComponent {
  readonly zId = input.required<string>();
  readonly month = input.required<string>();
  readonly zPlaceholder = input('Selecione o mês');
  readonly monthChange = output<string>();

  protected readonly date = computed(() => {
    if (!isValidMonth(this.month())) return null;
    const [year, month] = this.month().split('-').map(Number);
    return new Date(year, month - 1, 1, 12);
  });

  protected onDateChange(value: CalendarValue): void {
    const date = Array.isArray(value) ? value[0] : value;
    if (!date) return;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const next = `${date.getFullYear()}-${mm}`;
    if (next !== this.month()) this.monthChange.emit(next);
  }
}
