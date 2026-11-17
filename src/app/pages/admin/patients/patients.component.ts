import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideSearch, lucideUsers } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardCheckboxComponent } from '@/shared/components/checkbox';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
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
  imports: [
    NgIcon,
    ZardButtonComponent,
    ZardBadgeComponent,
    ZardAlertComponent,
    ZardCheckboxComponent,
    ZardInputComponent,
    ZardSkeletonComponent,
    ZardEmptyComponent,
    PatientFormComponent,
    ...ZardCardImports,
  ],
  viewProviders: [provideIcons({ lucidePlus, lucideSearch, lucideUsers })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Pacientes</h1>
          <p class="text-xs text-muted-foreground mt-0.5">Cadastro e acordos de atendimento.</p>
        </div>
        <button z-button type="button" [zDisabled]="form().mode === 'create'" (click)="openCreate()" class="h-10 rounded-xl px-4">
          <ng-icon name="lucidePlus" class="size-4" />
          Novo paciente
        </button>
      </header>

      @if (form(); as current) {
        <div class="animate-fade-in">
          @if (current.mode === 'create') {
            <app-patient-form [onFailed]="reportFailure" (saved)="onSaved()" (cancelled)="closeForm()" />
          } @else if (current.mode === 'edit') {
            @for (p of [current.patient]; track p.id) {
              <app-patient-form [patient]="p" [onFailed]="reportFailure" (saved)="onSaved()" (cancelled)="closeForm()" />
            }
          }
        </div>
      }

      <div class="flex flex-wrap items-end gap-4">
        <div class="space-y-1.5 grow max-w-sm">
          <label for="patient-search" class="text-sm font-medium text-foreground">Buscar por nome</label>
          <div class="relative">
            <ng-icon name="lucideSearch" class="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              z-input
              id="patient-search"
              name="search"
              type="search"
              autocomplete="off"
              placeholder="Filtrar paciente..."
              class="h-11 rounded-xl bg-white pl-9"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </div>
        </div>
        <div class="flex items-center min-h-11">
          <z-checkbox
            zId="show-inactive"
            [checked]="showInactive()"
            (checkChange)="showInactive.set($event)"
            class="text-sm text-muted-foreground"
          >
            Mostrar inativos
          </z-checkbox>
        </div>
      </div>

      @if (actionError()) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="actionError()!" />
      }

      @if (service.error()) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="service.error()!" />
      } @else if (!service.loaded()) {
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">Carregando pacientes...</p>
          @for (i of [1, 2, 3]; track i) {
            <z-skeleton class="h-22 w-full rounded-2xl" />
          }
        </div>
      } @else if (visible().length === 0) {
        <z-empty zIcon="lucideUsers" [zDescription]="emptyMessage()" class="bg-card rounded-2xl border border-border py-10" />
      } @else {
        <ul class="space-y-3 stagger-list">
          @for (patient of visible(); track patient.id) {
            <li>
              <z-card class="rounded-2xl p-4 shadow-2xs transition-[box-shadow,border-color] duration-200 hover:shadow-sm">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0 space-y-0.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-medium text-foreground">{{ patient.name }}</p>
                      @if (!patient.active) {
                        <z-badge zType="secondary" class="bg-muted text-muted-foreground">Inativo</z-badge>
                      }
                    </div>
                    <p class="text-sm text-muted-foreground tabular-nums">{{ patient.phone }}</p>
                    <p class="text-sm text-muted-foreground tabular-nums">
                      {{ summary(patient.agreement) }} · {{ patient.agreement.sessionsPerMonth }}
                      {{ patient.agreement.sessionsPerMonth === 1 ? 'sessão/mês' : 'sessões/mês' }}
                    </p>
                  </div>

                  @if (confirmingId() === patient.id) {
                    <div
                      class="flex flex-wrap items-center gap-2 animate-fade-in"
                      role="group"
                      [attr.aria-label]="'Confirmar inativação de ' + patient.name"
                    >
                      <span class="text-sm text-foreground">Inativar {{ patient.name }}?</span>
                      <button
                        z-button
                        zType="destructive"
                        zSize="sm"
                        type="button"
                        [zLoading]="busyId() === patient.id"
                        [zDisabled]="busyId() === patient.id"
                        (click)="setActive(patient, false)"
                      >
                        Confirmar
                      </button>
                      <button
                        z-button
                        zType="outline"
                        zSize="sm"
                        type="button"
                        [zDisabled]="busyId() === patient.id"
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
                        [zDisabled]="busyId() === patient.id"
                        (click)="openEdit(patient)"
                      >
                        Editar
                      </button>
                      @if (patient.active) {
                        <button
                          z-button
                          zType="outline"
                          zSize="sm"
                          type="button"
                          [zDisabled]="busyId() === patient.id"
                          (click)="askDeactivate(patient)"
                        >
                          Inativar
                        </button>
                      } @else {
                        <button
                          z-button
                          zType="outline"
                          zSize="sm"
                          type="button"
                          [zLoading]="busyId() === patient.id"
                          [zDisabled]="busyId() === patient.id"
                          (click)="setActive(patient, true)"
                        >
                          Reativar
                        </button>
                      }
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
    return this.showInactive()
      ? 'Nenhum paciente cadastrado.'
      : 'Nenhum paciente ativo. Use "Novo paciente" para cadastrar.';
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

  onSaved(): void {
    this.actionError.set(null);
    this.closeForm();
  }

  closeForm(): void {
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
      this.actionError.set(
        err instanceof Error
          ? err.message
          : 'Não foi possível confirmar o salvamento. Verifique sua conexão e tente novamente.',
      );
    } finally {
      this.busyId.set(null);
    }
  }
}
