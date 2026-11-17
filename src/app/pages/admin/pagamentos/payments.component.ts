import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideWallet } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { PatientsService } from '../data/patients.service';
import { SAVE_ERROR } from '../data/safe-write';
import { PaymentsService } from '../data/payments.service';
import { REMOVED_PATIENT_LABEL } from '../domain/finance';
import { formatCents } from '../domain/money';
import { isValidMonth } from '../domain/month';
import type { Payment } from '../domain/models';
import { parsePixPrefill } from '../domain/pix-prefill';
import type { PixPrefill } from '../domain/pix-prefill';
import { filterPayments, formatMonth, formatPaidAt } from '../domain/payments-view';
import { PaymentFormComponent } from './payment-form.component';

type FormState =
  | { mode: 'closed' }
  | { mode: 'create'; prefill: PixPrefill | null }
  | { mode: 'edit'; payment: Payment };

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    NgIcon,
    ZardButtonComponent,
    ZardAlertComponent,
    ZardInputComponent,
    ZardNativeSelectDirective,
    ZardSkeletonComponent,
    ZardEmptyComponent,
    PaymentFormComponent,
    ...ZardCardImports,
  ],
  viewProviders: [provideIcons({ lucidePlus, lucideWallet })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Pagamentos</h1>
          <p class="text-xs text-muted-foreground mt-0.5">Registre e acompanhe os recebimentos via Pix.</p>
        </div>
        <button
          z-button
          type="button"
          class="h-10 rounded-xl px-4"
          [zDisabled]="form().mode === 'create'"
          (click)="openCreate()"
        >
          <ng-icon name="lucidePlus" class="size-4" />
          Registrar Pix
        </button>
      </header>

      @if (form(); as current) {
        <div class="animate-fade-in">
          @if (current.mode === 'create') {
            <!-- Pix de link só abre com a lista de pacientes carregada; antes disso o paciente pareceria inexistente. -->
            @if (patientsService.loaded()) {
              <app-payment-form [prefill]="current.prefill" [onFailed]="reportFailure" (saved)="onSaved()" (cancelled)="closeForm()" />
            }
          } @else if (current.mode === 'edit') {
            @for (p of [current.payment]; track p.id) {
              <app-payment-form [payment]="p" [onFailed]="reportFailure" (saved)="onSaved()" (cancelled)="closeForm()" />
            }
          }
        </div>
      }

      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-1.5">
          <label for="payment-filter-month" class="block text-sm font-medium text-foreground">Mês de referência</label>
          <input
            z-input
            id="payment-filter-month"
            name="month"
            type="month"
            class="h-11 rounded-xl bg-white w-auto"
            [value]="monthFilter()"
            (change)="setMonthFilter($any($event.target).value)"
          />
        </div>

        <div class="space-y-1.5 grow max-w-xs">
          <label for="payment-filter-patient" class="block text-sm font-medium text-foreground">Paciente</label>
          <select
            z-native-select
            id="payment-filter-patient"
            name="patientId"
            class="h-11 rounded-xl bg-white"
            (change)="patientFilter.set($any($event.target).value)"
          >
            <option value="" [selected]="patientFilter() === ''">Todos os pacientes</option>
            @for (patient of patientsService.patients(); track patient.id) {
              <option [value]="patient.id" [selected]="patient.id === patientFilter()">
                {{ patient.name }}{{ patient.active ? '' : ' (inativo)' }}
              </option>
            }
          </select>
        </div>
      </div>

      @if (actionError()) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="actionError()!" />
      }

      @if (loadError(); as message) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
      } @else if (!ready()) {
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">Carregando pagamentos...</p>
          @for (i of [1, 2, 3]; track i) {
            <z-skeleton class="h-22 w-full rounded-2xl" />
          }
        </div>
      } @else if (visible().length === 0) {
        <z-empty zIcon="lucideWallet" [zDescription]="emptyMessage()" class="bg-card rounded-2xl border border-border py-10" />
      } @else {
        <ul class="space-y-3 stagger-list">
          @for (payment of visible(); track payment.id) {
            <li>
              <z-card class="rounded-2xl p-4 shadow-2xs transition-[box-shadow,border-color] duration-200 hover:shadow-sm">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 space-y-0.5">
                    <p class="font-medium text-foreground">{{ patientName(payment) }}</p>
                    <p class="text-sm font-medium text-primary tabular-nums">{{ formatCents(payment.amount) }}</p>
                    <p class="text-sm text-muted-foreground tabular-nums">
                      Pago em {{ formatPaidAt(payment.paidAt) }} · referente a {{ formatMonth(payment.referenceMonth) }}
                    </p>
                    @if (payment.note) {
                      <p class="text-sm text-muted-foreground">{{ payment.note }}</p>
                    }
                  </div>

                  @if (confirmingId() === payment.id) {
                    <div
                      class="flex flex-wrap items-center gap-2 animate-fade-in"
                      role="group"
                      [attr.aria-label]="'Confirmar exclusão do Pix de ' + patientName(payment)"
                    >
                      <span class="text-sm text-foreground">Excluir o Pix de {{ formatCents(payment.amount) }}?</span>
                      <button
                        z-button
                        zType="destructive"
                        zSize="sm"
                        type="button"
                        [zLoading]="busyId() === payment.id"
                        [zDisabled]="busyId() !== null"
                        (click)="remove(payment)"
                      >
                        Confirmar
                      </button>
                      <button
                        z-button
                        zType="outline"
                        zSize="sm"
                        type="button"
                        [zDisabled]="busyId() === payment.id"
                        (click)="confirmingId.set(null)"
                      >
                        Cancelar
                      </button>
                    </div>
                  } @else {
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        z-button
                        zType="outline"
                        zSize="sm"
                        type="button"
                        [zDisabled]="busyId() === payment.id"
                        (click)="openEdit(payment)"
                      >
                        Editar
                      </button>
                      <button
                        z-button
                        zType="outline"
                        zSize="sm"
                        type="button"
                        [zDisabled]="busyId() === payment.id"
                        (click)="askRemove(payment)"
                      >
                        Excluir
                      </button>
                    </div>
                  }
                </div>
              </z-card>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PaymentsComponent {
  protected readonly service = inject(PaymentsService);
  protected readonly patientsService = inject(PatientsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly formatCents = formatCents;
  protected readonly formatPaidAt = formatPaidAt;
  protected readonly formatMonth = formatMonth;

  readonly monthFilter = signal('');
  readonly patientFilter = signal('');
  readonly form = signal<FormState>(this.initialForm());
  readonly confirmingId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  protected readonly reportFailure = (message: string) => this.actionError.set(message);

  readonly ready = computed(() => this.service.loaded() && this.patientsService.loaded());
  readonly loadError = computed(() => this.service.error() ?? this.patientsService.error());

  readonly visible = computed(() =>
    filterPayments(this.service.payments(), {
      month: this.monthFilter(),
      patientId: this.patientFilter(),
    }),
  );

  readonly patientNames = computed(
    () => new Map(this.patientsService.patients().map(patient => [patient.id, patient.name] as const)),
  );

  readonly emptyMessage = computed(() => {
    if (this.monthFilter() !== '' || this.patientFilter() !== '') {
      return 'Nenhum Pix encontrado para esses filtros.';
    }
    return 'Nenhum Pix registrado. Use "Registrar Pix" para começar.';
  });

  protected patientName(payment: Payment): string {
    return this.patientNames().get(payment.patientId) ?? REMOVED_PATIENT_LABEL;
  }

  setMonthFilter(value: string): void {
    if (value === '' || isValidMonth(value)) this.monthFilter.set(value);
  }

  openCreate(): void {
    this.confirmingId.set(null);
    this.form.set({ mode: 'create', prefill: null });
  }

  openEdit(payment: Payment): void {
    this.confirmingId.set(null);
    this.form.set({ mode: 'edit', payment });
  }

  onSaved(): void {
    this.actionError.set(null);
    this.closeForm();
  }

  closeForm(): void {
    this.form.set({ mode: 'closed' });
  }

  askRemove(payment: Payment): void {
    this.actionError.set(null);
    this.confirmingId.set(payment.id);
  }

  async remove(payment: Payment): Promise<void> {
    if (this.busyId() !== null) return;
    this.actionError.set(null);
    this.busyId.set(payment.id);
    try {
      await this.service.remove(payment.id);
      this.confirmingId.set(null);
      const current = this.form();
      if (current.mode === 'edit' && current.payment.id === payment.id) this.closeForm();
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.busyId.set(null);
    }
  }

  /** Abre o formulário já preenchido quando a tela chega pelo link de Registrar Pix da Financeiro. */
  private initialForm(): FormState {
    const prefill = parsePixPrefill(this.route.snapshot.queryParamMap);
    return prefill ? { mode: 'create', prefill } : { mode: 'closed' };
  }
}
