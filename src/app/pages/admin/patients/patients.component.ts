import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { PatientsService } from '../data/patients.service';
import { formatCents } from '../domain/money';
import type { Agreement, Patient } from '../domain/models';
import { matchesSearch } from '../domain/text';
import { PatientFormComponent } from './patient-form.component';

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; patient: Patient };

export function agreementSummary(agreement: Agreement): string {
  const amount = formatCents(agreement.amount);
  return agreement.type === 'per_session' ? `${amount} por sessão` : `Pacote mensal ${amount}`;
}

@Component({
  selector: 'app-admin-patients',
  standalone: true,
  imports: [ZardButtonComponent, PatientFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="font-display text-2xl text-[#1C221F] tracking-tight">Pacientes</h1>
        <button z-button type="button" [zDisabled]="form().mode === 'create'" (click)="openCreate()">Novo paciente</button>
      </header>

      @if (form(); as current) {
        @if (current.mode === 'create') {
          <app-patient-form [onFailed]="reportFailure" (saved)="closeForm()" (cancelled)="closeForm()" />
        } @else if (current.mode === 'edit') {
          @for (p of [current.patient]; track p.id) {
            <app-patient-form [patient]="p" [onFailed]="reportFailure" (saved)="closeForm()" (cancelled)="closeForm()" />
          }
        }
      }

      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-1.5 grow max-w-sm">
          <label for="patient-search" class="text-sm font-medium text-[#1C221F]">Buscar por nome</label>
          <input
            id="patient-search"
            name="search"
            type="search"
            autocomplete="off"
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
        </div>
        <div class="flex items-center gap-2 min-h-11">
          <input
            id="show-inactive"
            name="showInactive"
            type="checkbox"
            class="size-5 accent-[#4D6D66]"
            [checked]="showInactive()"
            (change)="showInactive.set($any($event.target).checked)"
          />
          <label for="show-inactive" class="text-sm text-[#556661]">Mostrar inativos</label>
        </div>
      </div>

      @if (actionError()) {
        <p role="alert" class="text-sm text-red-700">{{ actionError() }}</p>
      }

      @if (service.error()) {
        <p role="alert" class="text-sm text-red-700">{{ service.error() }}</p>
      } @else if (!service.loaded()) {
        <p class="text-sm text-[#556661]">Carregando pacientes...</p>
      } @else if (visible().length === 0) {
        <p class="text-sm text-[#556661]">
          {{ emptyMessage() }}
        </p>
      } @else {
        <ul class="space-y-3">
          @for (patient of visible(); track patient.id) {
            <li class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-medium text-[#1C221F]">
                    {{ patient.name }}
                    @if (!patient.active) {
                      <span class="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-[#4C645B]/10 text-[#556661]">Inativo</span>
                    }
                  </p>
                  <p class="text-sm text-[#556661]">{{ patient.phone }}</p>
                  <p class="text-sm text-[#556661]">
                    {{ summary(patient.agreement) }} · {{ patient.agreement.sessionsPerMonth }}
                    {{ patient.agreement.sessionsPerMonth === 1 ? 'sessão/mês' : 'sessões/mês' }}
                  </p>
                </div>

                @if (confirmingId() === patient.id) {
                  <div class="flex flex-wrap items-center gap-2" role="group" [attr.aria-label]="'Confirmar inativação de ' + patient.name">
                    <span class="text-sm text-[#1C221F]">Inativar {{ patient.name }}?</span>
                    <button z-button zType="destructive" zSize="sm" type="button" [zLoading]="busyId() === patient.id" [zDisabled]="busyId() === patient.id" (click)="setActive(patient, false)">Confirmar</button>
                    <button z-button zType="outline" zSize="sm" type="button" [zDisabled]="busyId() === patient.id" (click)="confirmingId.set(null)">Cancelar</button>
                  </div>
                } @else {
                  <div class="flex flex-wrap items-center gap-2">
                    <button z-button zType="outline" zSize="sm" type="button" [zDisabled]="busyId() === patient.id" (click)="openEdit(patient)">Editar</button>
                    @if (patient.active) {
                      <button z-button zType="outline" zSize="sm" type="button" [zDisabled]="busyId() === patient.id" (click)="askDeactivate(patient)">Inativar</button>
                    } @else {
                      <button z-button zType="outline" zSize="sm" type="button" [zLoading]="busyId() === patient.id" [zDisabled]="busyId() === patient.id" (click)="setActive(patient, true)">Reativar</button>
                    }
                  </div>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PatientsComponent {
  protected readonly service = inject(PatientsService);

  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly form = signal<FormState>({ mode: 'closed' });
  readonly confirmingId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  protected readonly reportFailure = (message: string) => this.actionError.set(message);

  readonly visible = computed(() => {
    const query = this.search();
    const includeInactive = this.showInactive();
    return this.service
      .patients()
      .filter(p => (includeInactive || p.active) && matchesSearch(p.name, query));
  });

  readonly emptyMessage = computed(() => {
    if (this.search().trim() !== '') return 'Nenhum paciente encontrado para essa busca.';
    return this.showInactive() ? 'Nenhum paciente cadastrado.' : 'Nenhum paciente ativo. Use "Novo paciente" para cadastrar.';
  });

  protected summary(agreement: Agreement): string {
    return agreementSummary(agreement);
  }

  openCreate(): void {
    this.form.set({ mode: 'create' });
  }

  openEdit(patient: Patient): void {
    this.confirmingId.set(null);
    this.form.set({ mode: 'edit', patient });
  }

  closeForm(): void {
    this.actionError.set(null);
    this.form.set({ mode: 'closed' });
  }

  askDeactivate(patient: Patient): void {
    this.actionError.set(null);
    this.confirmingId.set(patient.id);
  }

  async setActive(patient: Patient, active: boolean): Promise<void> {
    if (this.busyId() !== null) return;
    this.actionError.set(null);
    this.busyId.set(patient.id);
    try {
      await this.service.setActive(patient.id, active);
      this.confirmingId.set(null);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : 'Não foi possível confirmar o salvamento. Verifique sua conexão e tente novamente.');
    } finally {
      this.busyId.set(null);
    }
  }
}
