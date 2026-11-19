import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSelectImports } from '@/shared/components/select';
import { ZardSwitchComponent } from '@/shared/components/switch';
import { PatientsService } from '../data/patients.service';
import type { AgreementType, Patient } from '../domain/models';
import { patientToFormValue, toPatientInput } from '../domain/patient-form';
import type { PatientFormErrors } from '../domain/patient-form';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [
    ZardButtonComponent,
    ZardInputComponent,
    ...ZardSelectImports,
    ZardSwitchComponent,
    ZardAlertComponent,
    ...ZardCardImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-card class="rounded-2xl p-5 shadow-xs">
      <form class="space-y-4" novalidate (submit)="submit($event)">
        <h2 class="font-display text-xl text-foreground tracking-tight">
          {{ patient() ? 'Editar paciente' : 'Novo paciente' }}
        </h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label for="patient-name" class="block text-sm font-medium text-foreground">Nome</label>
            <input
              z-input
              id="patient-name"
              name="name"
              type="text"
              autocomplete="off"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().name ? 'true' : null"
              [attr.aria-describedby]="errors().name ? 'patient-name-error' : null"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
            />
            @if (errors().name) {
              <p id="patient-name-error" class="admin-field-error text-sm text-red-700">{{ errors().name }}</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="patient-phone" class="block text-sm font-medium text-foreground">Telefone</label>
            <input
              z-input
              id="patient-phone"
              name="phone"
              type="tel"
              autocomplete="off"
              inputmode="tel"
              placeholder="(11) 98888-7777"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().phone ? 'true' : null"
              [attr.aria-describedby]="errors().phone ? 'patient-phone-error' : null"
              [value]="phone()"
              (input)="phone.set($any($event.target).value)"
            />
            @if (errors().phone) {
              <p id="patient-phone-error" class="admin-field-error text-sm text-red-700">{{ errors().phone }}</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="patient-type" class="block text-sm font-medium text-foreground">Tipo de acordo</label>
            <z-select
              id="patient-type"
              zLabel="Tipo de acordo"
              class="w-full"
              [zValue]="type()"
              (zSelectionChange)="type.set($any($event))"
            >
              <z-select-item zValue="per_session">Por sessão</z-select-item>
              <z-select-item zValue="monthly_package">Pacote mensal</z-select-item>
            </z-select>
            <p id="patient-type-hint" class="text-xs text-muted-foreground">
              Por sessão soma cada sessão realizada; pacote mensal cobra o valor fechado se houver sessão ativa no mês.
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="patient-amount" class="block text-sm font-medium text-foreground">
              {{ type() === 'per_session' ? 'Valor por sessão' : 'Valor do pacote mensal' }}
            </label>
            <input
              z-input
              id="patient-amount"
              name="amount"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="150,00"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().amount ? 'true' : null"
              [attr.aria-describedby]="errors().amount ? 'patient-amount-error' : null"
              [value]="amount()"
              (input)="amount.set($any($event.target).value)"
            />
            @if (errors().amount) {
              <p id="patient-amount-error" class="admin-field-error text-sm text-red-700">{{ errors().amount }}</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="patient-sessions" class="block text-sm font-medium text-foreground">Sessões por mês</label>
            <input
              z-input
              id="patient-sessions"
              name="sessionsPerMonth"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class="h-11 rounded-xl bg-white"
              [attr.aria-invalid]="errors().sessionsPerMonth ? 'true' : null"
              [attr.aria-describedby]="errors().sessionsPerMonth ? 'patient-sessions-hint patient-sessions-error' : 'patient-sessions-hint'"
              [value]="sessionsPerMonth()"
              (input)="sessionsPerMonth.set($any($event.target).value)"
            />
            <p id="patient-sessions-hint" class="text-xs text-muted-foreground">
              Usado para calcular a receita prevista e avisar no Painel quando faltarem ou sobrarem sessões.
            </p>
            @if (errors().sessionsPerMonth) {
              <p id="patient-sessions-error" class="admin-field-error text-sm text-red-700">{{ errors().sessionsPerMonth }}</p>
            }
          </div>

          <div class="space-y-1.5 sm:self-end">
            <div class="flex items-center min-h-11">
              <z-switch
                zId="patient-charge-no-show"
                zAriaDescribedBy="patient-charge-no-show-hint"
                [(zChecked)]="chargeNoShow"
              >
                Cobrar faltas
              </z-switch>
            </div>
            <p id="patient-charge-no-show-hint" class="text-xs text-muted-foreground">
              Se ativo, sessões marcadas como 'Faltou' entram no valor devido (no acordo por sessão).
            </p>
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
export class PatientFormComponent implements OnInit {
  private readonly patients = inject(PatientsService);
  private destroyed = false;

  /** Gerado uma vez por formulário: toda tentativa de criar usa o mesmo documento. */
  private readonly newPatientId = this.patients.newId();

  /** Paciente em edição; `null` cria um novo. */
  readonly patient = input<Patient | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  /** Callback, não `output`: o Angular descarta `emit` de formulário destruído (Cancelar durante o salvamento). */
  readonly onFailed = input.required<(message: string) => void>();

  readonly name = signal('');
  readonly phone = signal('');
  readonly type = signal<AgreementType>('per_session');
  readonly amount = signal('');
  readonly sessionsPerMonth = signal('');
  readonly chargeNoShow = signal(false);

  readonly errors = signal<PatientFormErrors>({});
  readonly saveError = signal<string | null>(null);
  readonly busy = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

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
        await this.patients.create(this.newPatientId, result.value);
      }
      if (!this.destroyed) this.saved.emit();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível confirmar o salvamento. Verifique sua conexão e tente novamente.';
      this.onFailed()(message);
      if (!this.destroyed) this.saveError.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}
