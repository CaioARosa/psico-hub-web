import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardPopoverComponent, ZardPopoverDirective } from '@/shared/components/popover';
import { isValidMonth } from './domain/month';

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTH_ABBREVIATIONS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface MonthCell {
  readonly index: number;
  readonly value: string;
  readonly label: string;
  readonly name: string;
  readonly selected: boolean;
  readonly current: boolean;
}

/** Seletor de mês: navega por ano e escolhe um dos 12 meses. O valor é `YYYY-MM`. */
@Component({
  selector: 'app-month-picker',
  standalone: true,
  imports: [NgIcon, ZardButtonComponent, ZardPopoverComponent, ZardPopoverDirective],
  viewProviders: [provideIcons({ lucideCalendar, lucideChevronLeft, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex w-[212px]' },
  template: `
    <button
      z-button
      type="button"
      zType="outline"
      class="w-full justify-start text-start font-normal"
      [attr.id]="zId()"
      [attr.data-empty]="selected() ? null : 'true'"
      zPopover
      #popover="zPopover"
      [zContent]="monthsTemplate"
      zTrigger="click"
      zAlign="start"
      (zVisibleChange)="onVisibilityChange($event)"
    >
      <ng-icon name="lucideCalendar" class="size-4!" data-icon="inline-start" />
      <span class="min-w-0 truncate capitalize" [class.text-muted-foreground]="!selected()">{{ displayText() }}</span>
    </button>

    <ng-template #monthsTemplate>
      <z-popover aria-label="Escolher mês" class="w-64 p-3">
        <div class="mb-3 flex items-center justify-between">
          <button
            z-button
            type="button"
            zType="ghost"
            zSize="icon-sm"
            aria-label="Ano anterior"
            (click)="shiftYear(-1)"
          >
            <ng-icon name="lucideChevronLeft" class="size-4!" />
          </button>
          <span class="text-sm font-medium tabular-nums" aria-live="polite">{{ viewYear() }}</span>
          <button
            z-button
            type="button"
            zType="ghost"
            zSize="icon-sm"
            aria-label="Próximo ano"
            (click)="shiftYear(1)"
          >
            <ng-icon name="lucideChevronRight" class="size-4!" />
          </button>
        </div>
        <div class="grid grid-cols-3 gap-1.5" role="group" aria-label="Meses de {{ viewYear() }}">
          @for (cell of cells(); track cell.value) {
            <button
              z-button
              type="button"
              [zType]="cell.selected ? 'default' : cell.current ? 'secondary' : 'ghost'"
              class="capitalize"
              [attr.aria-label]="cell.name + ' de ' + viewYear()"
              [attr.aria-pressed]="cell.selected"
              [attr.data-month]="cell.value"
              (click)="pick(cell.value, popover)"
            >
              {{ cell.label }}
            </button>
          }
        </div>
      </z-popover>
    </ng-template>
  `,
})
export class MonthPickerComponent {
  readonly zId = input.required<string>();
  readonly month = input.required<string>();
  readonly zPlaceholder = input('Selecione o mês');
  readonly monthChange = output<string>();

  protected readonly viewYear = signal(new Date().getFullYear());

  protected readonly selected = computed(() => {
    const month = this.month();
    if (!isValidMonth(month)) return null;
    const [year, monthNumber] = month.split('-').map(Number);
    return { year, monthIndex: monthNumber - 1 };
  });

  protected readonly displayText = computed(() => {
    const selected = this.selected();
    return selected ? `${MONTH_NAMES[selected.monthIndex]} de ${selected.year}` : this.zPlaceholder();
  });

  protected readonly cells = computed<MonthCell[]>(() => {
    const year = this.viewYear();
    const selected = this.selected();
    const now = new Date();
    return MONTH_ABBREVIATIONS.map((label, index) => ({
      index,
      value: `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`,
      label,
      name: MONTH_NAMES[index],
      selected: selected?.year === year && selected.monthIndex === index,
      current: now.getFullYear() === year && now.getMonth() === index,
    }));
  });

  protected onVisibilityChange(visible: boolean): void {
    if (visible) this.viewYear.set(this.selected()?.year ?? new Date().getFullYear());
  }

  protected shiftYear(delta: number): void {
    this.viewYear.update(year => year + delta);
  }

  protected pick(value: string, popover: ZardPopoverDirective): void {
    popover.hide();
    if (value !== this.month()) this.monthChange.emit(value);
  }
}
