import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { type CalendarValue } from '@/shared/components/calendar';
import { ZardCardImports } from '@/shared/components/card';
import { ZardDatePickerComponent } from '@/shared/components/date-picker';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardNativeSelectDirective } from '@/shared/components/native-select';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SAVE_ERROR } from '../data/safe-write';
import { REMOVED_PATIENT_LABEL } from '../domain/finance';
import type { Payment } from '../domain/models';
import { prefillPatientExists } from '../domain/pix-prefill';
import type { PixPrefill } from '../domain/pix-prefill';
import {
  paymentToFormValue,
  referenceMonthOf,
  todayIso,
  toPaymentInput,
} from '../domain/payment-form';
import type { PaymentFormErrors } from '../domain/payment-form';

/** Criar Pix pode ter gravado antes do timeout; repetir às cegas duplica o registro. */
const POSSIBLY_SAVED_ERROR = `${SAVE_ERROR} O Pix pode ter sido salvo; confira o histórico antes de registrar de novo.`;

function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [
    ZardButtonComponent,
    ZardInputComponent,
    ZardNativeSelectDirective,
    ZardDatePickerComponent,
    ZardAlertComponent,
    ...ZardCardImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-card class="rounded-2xl p-5 shadow-xs">
      <form class="space-y-4" novalidate (submit)="submit($event)">
        <h2 class="font-display text-xl text-foreground tracking-tight">
          {{ payment() ? 'Editar Pix' : 'Registrar Pix' }}
        </h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5 sm:col-span-2">
            <label for="payment-patient" class="block text-sm font-medium text-foreground">Paciente</label>
            <select
              z-native-select
              id="payment-patient"
              name="patientId"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().patientId ? 'true' : null"
              [attr.aria-describedby]="errors().patientId ? 'payment-patient-error' : null"
              (change)="patientId.set($any($event.target).value)"
            >
              <option value="" [selected]="patientId() === ''">Selecione um paciente...</option>
              @if (orphanSelected()) {
                <option [value]="patientId()" [selected]="true">{{ removedPatientLabel }}</option>
              }
              @for (patient of patientsService.patients(); track patient.id) {
                <option [value]="patient.id" [selected]="patient.id === patientId()">
                  {{ patient.name }}{{ patient.active ? '' : ' (inativo)' }}
                </option>
              }
            </select>
            @if (errors().patientId) {
              <p id="payment-patient-error" class="text-sm text-red-700">{{ errors().patientId }}</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="payment-amount" class="block text-sm font-medium text-foreground">Valor</label>
            <input
              z-input
              id="payment-amount"
              name="amount"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="150,00"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().amount ? 'true' : null"
              [attr.aria-describedby]="errors().amount ? 'payment-amount-hint payment-amount-error' : 'payment-amount-hint'"
              [value]="amount()"
              (input)="amount.set($any($event.target).value)"
            />
            <p id="payment-amount-hint" class="text-xs text-muted-foreground">
              Se passar do devido do mês, o excedente abate atrasos antigos ou vira crédito automaticamente.
            </p>
            @if (errors().amount) {
              <p id="payment-amount-error" class="text-sm text-red-700">{{ errors().amount }}</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="payment-paid-at" class="block text-sm font-medium text-foreground">Data do Pix</label>
            <z-date-picker
              zId="payment-paid-at"
              zLocale="pt-BR"
              zFormat="dd/MM/yyyy"
              zPlaceholder="Selecione a data"
              zIcon="calendar"
              [value]="paidAtDate()"
              (dateChange)="onPaidAtPickerChange($event)"
              class="w-full"
            />
            @if (errors().paidAt) {
              <p id="payment-paid-at-error" class="text-sm text-red-700">{{ errors().paidAt }}</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="payment-reference-month" class="block text-sm font-medium text-foreground">Mês de referência</label>
            <input
              z-input
              id="payment-reference-month"
              name="referenceMonth"
              type="month"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().referenceMonth ? 'true' : null"
              [attr.aria-describedby]="errors().referenceMonth ? 'payment-reference-month-hint payment-reference-month-error' : 'payment-reference-month-hint'"
              [value]="referenceMonth()"
              (input)="setReferenceMonth($any($event.target).value)"
            />
            <p id="payment-reference-month-hint" class="text-xs text-muted-foreground">
              Mês das sessões que este Pix paga — ajuste se for pagamento atrasado ou adiantado.
            </p>
            @if (errors().referenceMonth) {
              <p id="payment-reference-month-error" class="text-sm text-red-700">{{ errors().referenceMonth }}</p>
            }
          </div>

          <div class="space-y-1.5 sm:col-span-2">
            <label for="payment-note" class="block text-sm font-medium text-foreground">Observação (opcional)</label>
            <input
              z-input
              id="payment-note"
              name="note"
              type="text"
              autocomplete="off"
              class="h-11 rounded-xl bg-white"
              [value]="note()"
              (input)="note.set($any($event.target).value)"
            />
          </div>
        </div>

        @if (saveError()) {
          <z-alert zType="destructive" zRole="alert" [zDescription]="saveError()!" />
        }

        <div class="flex flex-wrap gap-2 justify-end pt-2">
          <button z-button zType="outline" type="button" (click)="cancelled.emit()">Cancelar</button>
          <button z-button type="submit" [zLoading]="busy()" [zDisabled]="busy()">Salvar</button>
        </div>
      </form>
    </z-card>
  `,
})
export class PaymentFormComponent implements OnInit {
  protected readonly patientsService = inject(PatientsService);
  private readonly payments = inject(PaymentsService);
  private destroyed = false;

  /** Gerado uma vez por formulário: toda tentativa de registrar usa o mesmo documento. */
  private readonly newPaymentId = this.payments.newId();

  /** Pix em edição; `null` registra um novo. */
  readonly payment = input<Payment | null>(null);
  /** Valores vindos da Financeiro (`Registrar Pix`). */
  readonly prefill = input<PixPrefill | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  /** Callback, não `output`: o Angular descarta `emit` de formulário destruído (Cancelar durante o salvamento). */
  readonly onFailed = input.required<(message: string) => void>();

  protected readonly removedPatientLabel = REMOVED_PATIENT_LABEL;

  readonly patientId = signal('');
  readonly amount = signal('');
  readonly paidAt = signal(todayIso(new Date()));
  readonly paidAtDate = computed(() => parseIsoDate(this.paidAt()));
  readonly referenceMonth = signal(referenceMonthOf(this.paidAt()));
  readonly note = signal('');

  readonly errors = signal<PaymentFormErrors>({});
  readonly saveError = signal<string | null>(null);
  readonly busy = signal(false);

  /** Pix de paciente removido: o id continua selecionado, com o rótulo "Paciente removido". */
  readonly orphanSelected = computed(() => {
    const id = this.patientId();
    return (
      id !== '' &&
      this.patientsService.loaded() &&
      !this.patientsService.patients().some(patient => patient.id === id)
    );
  });

  /** Depois de o mês ser alterado pela usuária (ou preenchido de um Pix existente), ele não segue mais a data. */
  private referenceMonthTouched = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  ngOnInit(): void {
    const payment = this.payment();
    if (payment) {
      const value = paymentToFormValue(payment);
      this.patientId.set(value.patientId);
      this.amount.set(value.amount);
      this.paidAt.set(value.paidAt);
      this.referenceMonth.set(value.referenceMonth);
      this.note.set(value.note);
      this.referenceMonthTouched = true;
      return;
    }

    const prefill = this.prefill();
    if (prefill && prefillPatientExists(prefill, this.patientsService.patients().map(patient => patient.id))) {
      this.patientId.set(prefill.patientId);
      this.amount.set(prefill.amount);
      this.referenceMonth.set(prefill.referenceMonth);
      this.referenceMonthTouched = true;
    }
  }

  onPaidAtPickerChange(value: CalendarValue): void {
    const date = Array.isArray(value) ? (value[0] ?? null) : value instanceof Date ? value : null;
    if (!date) return;
    this.setPaidAt(toIsoDate(date));
  }

  setPaidAt(value: string): void {
    this.paidAt.set(value);
    if (!this.referenceMonthTouched) this.referenceMonth.set(referenceMonthOf(value));
  }

  setReferenceMonth(value: string): void {
    this.referenceMonthTouched = true;
    this.referenceMonth.set(value);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;

    const result = toPaymentInput({
      patientId: this.patientId(),
      amount: this.amount(),
      paidAt: this.paidAt(),
      referenceMonth: this.referenceMonth(),
      note: this.note(),
    });
    if (!result.ok) {
      this.errors.set(result.errors);
      this.saveError.set(null);
      return;
    }

    this.errors.set({});
    this.saveError.set(null);
    this.busy.set(true);
    try {
      const payment = this.payment();
      if (payment) {
        await this.payments.update(payment.id, result.value);
      } else {
        await this.payments.create(this.newPaymentId, result.value);
      }
      if (!this.destroyed) this.saved.emit();
    } catch (err) {
      const message = err instanceof Error ? err.message : SAVE_ERROR;
      const failure = this.payment() ? message : POSSIBLY_SAVED_ERROR;
      this.onFailed()(failure);
      if (!this.destroyed) this.saveError.set(failure);
    } finally {
      this.busy.set(false);
    }
  }
}
