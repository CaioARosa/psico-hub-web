import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { PatientsService } from '../data/patients.service';
import type { AgreementType, Patient } from '../domain/models';
import { patientToFormValue, toPatientInput } from '../domain/patient-form';
import type { PatientFormErrors } from '../domain/patient-form';

@Component({
  selector: 'app-patient-form',
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
        {{ patient() ? 'Editar paciente' : 'Novo paciente' }}
      </h2>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label for="patient-name" class="text-sm font-medium text-[#1C221F]">Nome</label>
          <input
            id="patient-name"
            name="name"
            type="text"
            autocomplete="off"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().name ? 'true' : null"
            [attr.aria-describedby]="errors().name ? 'patient-name-error' : null"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
          />
          @if (errors().name) {
            <p id="patient-name-error" class="text-sm text-red-700">{{ errors().name }}</p>
          }
        </div>

        <div class="space-y-1.5">
          <label for="patient-phone" class="text-sm font-medium text-[#1C221F]">Telefone</label>
          <input
            id="patient-phone"
            name="phone"
            type="tel"
            autocomplete="off"
            inputmode="tel"
            placeholder="(11) 98888-7777"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().phone ? 'true' : null"
            [attr.aria-describedby]="errors().phone ? 'patient-phone-error' : null"
            [value]="phone()"
            (input)="phone.set($any($event.target).value)"
          />
          @if (errors().phone) {
            <p id="patient-phone-error" class="text-sm text-red-700">{{ errors().phone }}</p>
          }
        </div>

        <div class="space-y-1.5">
          <label for="patient-type" class="text-sm font-medium text-[#1C221F]">Tipo de acordo</label>
          <select
            id="patient-type"
            name="type"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [value]="type()"
            (change)="type.set($any($event.target).value)"
          >
            <option value="per_session">Por sessão</option>
            <option value="monthly_package">Pacote mensal</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label for="patient-amount" class="text-sm font-medium text-[#1C221F]">
            {{ type() === 'per_session' ? 'Valor por sessão' : 'Valor do pacote mensal' }}
          </label>
          <input
            id="patient-amount"
            name="amount"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="150,00"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().amount ? 'true' : null"
            [attr.aria-describedby]="errors().amount ? 'patient-amount-error' : null"
            [value]="amount()"
            (input)="amount.set($any($event.target).value)"
          />
          @if (errors().amount) {
            <p id="patient-amount-error" class="text-sm text-red-700">{{ errors().amount }}</p>
          }
        </div>

        <div class="space-y-1.5">
          <label for="patient-sessions" class="text-sm font-medium text-[#1C221F]">Sessões por mês</label>
          <input
            id="patient-sessions"
            name="sessionsPerMonth"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [attr.aria-invalid]="errors().sessionsPerMonth ? 'true' : null"
            [attr.aria-describedby]="errors().sessionsPerMonth ? 'patient-sessions-error' : null"
            [value]="sessionsPerMonth()"
            (input)="sessionsPerMonth.set($any($event.target).value)"
          />
          @if (errors().sessionsPerMonth) {
            <p id="patient-sessions-error" class="text-sm text-red-700">{{ errors().sessionsPerMonth }}</p>
          }
        </div>

        <div class="flex items-center gap-3 sm:self-end min-h-11">
          <input
            id="patient-charge-no-show"
            name="chargeNoShow"
            type="checkbox"
            role="switch"
            class="size-5 accent-[#4D6D66]"
            [checked]="chargeNoShow()"
            (change)="chargeNoShow.set($any($event.target).checked)"
          />
          <label for="patient-charge-no-show" class="text-sm font-medium text-[#1C221F]">Cobrar faltas</label>
        </div>
      </div>

      @if (saveError()) {
        <p role="alert" class="text-sm text-red-700">{{ saveError() }}</p>
      }

      <div class="flex flex-wrap gap-2 justify-end">
        <button z-button zType="outline" type="button" [zDisabled]="busy()" (click)="cancelled.emit()">Cancelar</button>
        <button z-button type="submit" [zLoading]="busy()" [zDisabled]="busy()">Salvar</button>
      </div>
    </form>
  `,
})
export class PatientFormComponent implements OnInit {
  private readonly patients = inject(PatientsService);

  /** Paciente em edição; `null` cria um novo. */
  readonly patient = input<Patient | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly name = signal('');
  readonly phone = signal('');
  readonly type = signal<AgreementType>('per_session');
  readonly amount = signal('');
  readonly sessionsPerMonth = signal('');
  readonly chargeNoShow = signal(false);

  readonly errors = signal<PatientFormErrors>({});
  readonly saveError = signal<string | null>(null);
  readonly busy = signal(false);

  ngOnInit(): void {
    const patient = this.patient();
    if (!patient) return;
    const value = patientToFormValue(patient);
    this.name.set(value.name);
    this.phone.set(value.phone);
    this.type.set(value.type);
    this.amount.set(value.amount);
    this.sessionsPerMonth.set(value.sessionsPerMonth);
    this.chargeNoShow.set(value.chargeNoShow);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;

    const result = toPatientInput({
      name: this.name(),
      phone: this.phone(),
      type: this.type(),
      amount: this.amount(),
      sessionsPerMonth: this.sessionsPerMonth(),
      chargeNoShow: this.chargeNoShow(),
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
      const patient = this.patient();
      if (patient) {
        await this.patients.update(patient.id, result.value);
      } else {
        await this.patients.create(result.value);
      }
      this.saved.emit();
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      this.busy.set(false);
    }
  }
}
