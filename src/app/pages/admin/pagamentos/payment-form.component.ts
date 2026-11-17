import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
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

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-5 space-y-4"
      novalidate
      (submit)="submit($event)"
    >
      <h2 class="font-display text-xl text-[#1C221F] tracking-tight">
        {{ payment() ? 'Editar Pix' : 'Registrar Pix' }}
      </h2>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5 sm:col-span-2">
          <label for="payment-patient" class="text-sm font-medium text-[#1C221F]">Paciente</label>
          <select
            id="payment-patient"
            name="patientId"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
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
          <label for="payment-amount" class="text-sm font-medium text-[#1C221F]">Valor</label>
          <input
            id="payment-amount"
            name="amount"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="150,00"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().amount ? 'true' : null"
            [attr.aria-describedby]="errors().amount ? 'payment-amount-hint payment-amount-error' : 'payment-amount-hint'"
            [value]="amount()"
            (input)="amount.set($any($event.target).value)"
          />
          <p id="payment-amount-hint" class="text-xs text-[#556661]">
            Se passar do devido do mês, o excedente abate atrasos antigos ou vira crédito automaticamente.
          </p>
          @if (errors().amount) {
            <p id="payment-amount-error" class="text-sm text-red-700">{{ errors().amount }}</p>
          }
        </div>

        <div class="space-y-1.5">
          <label for="payment-paid-at" class="text-sm font-medium text-[#1C221F]">Data do Pix</label>
          <input
            id="payment-paid-at"
            name="paidAt"
            type="date"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().paidAt ? 'true' : null"
            [attr.aria-describedby]="errors().paidAt ? 'payment-paid-at-error' : null"
            [value]="paidAt()"
            (input)="setPaidAt($any($event.target).value)"
          />
          @if (errors().paidAt) {
            <p id="payment-paid-at-error" class="text-sm text-red-700">{{ errors().paidAt }}</p>
          }
        </div>

        <div class="space-y-1.5">
          <label for="payment-reference-month" class="text-sm font-medium text-[#1C221F]">Mês de referência</label>
          <input
            id="payment-reference-month"
            name="referenceMonth"
            type="month"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().referenceMonth ? 'true' : null"
            [attr.aria-describedby]="errors().referenceMonth ? 'payment-reference-month-hint payment-reference-month-error' : 'payment-reference-month-hint'"
            [value]="referenceMonth()"
            (input)="setReferenceMonth($any($event.target).value)"
          />
          <p id="payment-reference-month-hint" class="text-xs text-[#556661]">
            Mês das sessões que este Pix paga — ajuste se for pagamento atrasado ou adiantado.
          </p>
          @if (errors().referenceMonth) {
            <p id="payment-reference-month-error" class="text-sm text-red-700">{{ errors().referenceMonth }}</p>
          }
        </div>

        <div class="space-y-1.5 sm:col-span-2">
          <label for="payment-note" class="text-sm font-medium text-[#1C221F]">Observação (opcional)</label>
          <input
            id="payment-note"
            name="note"
            type="text"
            autocomplete="off"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [value]="note()"
            (input)="note.set($any($event.target).value)"
          />
        </div>
      </div>

      @if (saveError()) {
        <p role="alert" class="text-sm text-red-700">{{ saveError() }}</p>
      }

      <div class="flex flex-wrap gap-2 justify-end">
        <button z-button zType="outline" type="button" (click)="cancelled.emit()">Cancelar</button>
        <button z-button type="submit" [zLoading]="busy()" [zDisabled]="busy()">Salvar</button>
      </div>
    </form>
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
