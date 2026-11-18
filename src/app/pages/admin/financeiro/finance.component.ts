import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { ZardTableImports } from '@/shared/components/table';
import { MonthPickerComponent } from '../month-picker.component';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService } from '../data/sessions.service';
import { REMOVED_PATIENT_LABEL, buildLedger, summarizeMonth } from '../domain/finance';
import { whatsappChargeUrl } from '../domain/charge-message';
import { currentMonth, isValidMonth } from '../domain/month';
import { formatCents } from '../domain/money';
import { pixPrefillQuery } from '../domain/pix-prefill';
import { unlinkedNote } from '../domain/unlinked-note';

@Component({
  selector: 'app-admin-finance',
  standalone: true,
  imports: [
    RouterLink,
    ZardButtonComponent,
    ZardAlertComponent,
    MonthPickerComponent,
    ZardSkeletonComponent,
    ...ZardCardImports,
    ...ZardTableImports,
  ],
  viewProviders: [provideIcons({ lucideInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Financeiro</h1>
          <p class="text-xs text-muted-foreground mt-0.5">Extrato por paciente, abatimentos e cobrança.</p>
        </div>

        <div class="space-y-1.5">
          <label for="finance-month" class="block text-sm font-medium text-foreground">Mês</label>
          <app-month-picker zId="finance-month" [month]="month()" (monthChange)="setMonth($event)" />
        </div>
      </header>

      @if (loadError(); as message) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
      } @else if (!ready()) {
        <div class="space-y-4">
          <p class="text-sm text-muted-foreground">Carregando financeiro...</p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            @for (i of [1, 2, 3]; track i) {
              <z-skeleton class="h-22 w-full rounded-2xl" />
            }
          </div>
          <z-skeleton class="h-56 w-full rounded-2xl" />
        </div>
      } @else {
        @if (!summary().hasSessions) {
          <z-alert
            zRole="status"
            zIcon="lucideInfo"
            class="bg-amber-50 border-amber-300/70 text-amber-950 rounded-xl"
            zDescription="Sincronize a agenda deste mês para ver o devido."
          />
        }
        @if (summary().unlinkedSessions > 0) {
          <z-alert
            zRole="status"
            zIcon="lucideInfo"
            class="bg-amber-50 border-amber-300/70 text-amber-950 rounded-xl"
            [zDescription]="unlinkedNote(summary().unlinkedSessions)"
          />
        }

        <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-list">
          <div class="bg-card rounded-2xl border border-border shadow-2xs p-4 transition-shadow hover:shadow-sm">
            <dt class="text-xs font-medium text-muted-foreground">Recebido</dt>
            <dd class="font-display text-2xl text-primary mt-1 tabular-nums">{{ formatCents(summary().received) }}</dd>
          </div>
          <div class="bg-card rounded-2xl border border-border shadow-2xs p-4 transition-shadow hover:shadow-sm">
            <dt class="text-xs font-medium text-muted-foreground">A receber</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums">{{ valueOrDash(summary().toReceive) }}</dd>
          </div>
          <div class="bg-card rounded-2xl border border-border shadow-2xs p-4 transition-shadow hover:shadow-sm">
            <dt class="text-xs font-medium text-muted-foreground">Em atraso</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums">{{ valueOrDash(summary().overdue) }}</dd>
          </div>
        </dl>

        @if (rows().length > 0) {
          <z-card class="rounded-2xl p-0 shadow-2xs overflow-hidden">
            <div class="overflow-x-auto">
              <table z-table class="min-w-[44rem] text-sm">
                <thead z-table-header class="text-muted-foreground bg-[#FDFBF7]/70">
                  <tr z-table-row>
                    <th z-table-head scope="col" class="px-4 py-3 text-left font-medium">Paciente</th>
                    <th z-table-head scope="col" class="px-4 py-3 text-right font-medium">Devido</th>
                    <th z-table-head scope="col" class="px-4 py-3 text-right font-medium">Recebido</th>
                    <th z-table-head scope="col" class="px-4 py-3 text-right font-medium">Abatido</th>
                    <th z-table-head scope="col" class="px-4 py-3 text-right font-medium">A receber</th>
                    <th z-table-head scope="col" class="px-4 py-3 text-right font-medium">Em atraso</th>
                    <th z-table-head scope="col" class="px-4 py-3 text-right font-medium">Crédito</th>
                    <th z-table-head scope="col" class="px-4 py-3"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody z-table-body class="text-foreground tabular-nums">
                  @for (row of rows(); track row.line.patientId) {
                    <tr z-table-row>
                      <th scope="row" class="px-4 py-3 text-left font-medium">{{ row.name }}</th>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.due) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ formatCents(row.line.received) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.abated) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.toReceive) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.overdue) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.credit) }}</td>
                      <td z-table-cell class="px-4 py-3">
                        <div class="flex flex-wrap items-center justify-end gap-2">
                          @if (row.line.sources.length > 0) {
                            <button
                              z-button
                              zType="outline"
                              zSize="sm"
                              type="button"
                              [attr.aria-expanded]="isExpanded(row.line.patientId)"
                              (click)="toggleDetails(row.line.patientId)"
                            >
                              Detalhes
                            </button>
                          }
                          @if (row.line.toReceive > 0) {
                            <a z-button zType="outline" zSize="sm" routerLink="/admin/pagamentos" [queryParams]="row.pixQuery">
                              Registrar Pix
                            </a>
                          }
                          @if (row.chargeUrl; as url) {
                            <a
                              z-button
                              zType="outline"
                              zSize="sm"
                              [href]="url"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Cobrar no WhatsApp
                            </a>
                          } @else if (row.invalidPhone) {
                            <span class="text-xs text-amber-800">
                              Telefone inválido para WhatsApp. Corrija em Pacientes.
                            </span>
                          }
                        </div>
                      </td>
                    </tr>
                    @if (isExpanded(row.line.patientId)) {
                      <tr z-table-row class="bg-[#FDFBF7] animate-fade-in">
                        <td z-table-cell colspan="8" class="px-4 py-3 text-sm text-muted-foreground">
                          <ul class="space-y-1">
                            @for (source of row.line.sources; track source.fromMonth) {
                              <li>{{ formatCents(source.amount) }} abatidos com o crédito de {{ source.fromMonth }}</li>
                            }
                          </ul>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
                <tfoot z-table-footer class="font-medium text-foreground tabular-nums bg-[#F5F2ED]/60">
                  <tr z-table-row>
                    <th scope="row" class="px-4 py-3 text-left">Total</th>
                    <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(summary().totals.due) }}</td>
                    <td z-table-cell class="px-4 py-3 text-right">{{ formatCents(summary().totals.received) }}</td>
                    <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(summary().totals.abated) }}</td>
                    <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(summary().totals.toReceive) }}</td>
                    <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(summary().totals.overdue) }}</td>
                    <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(summary().totals.credit) }}</td>
                    <td z-table-cell class="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </z-card>
          <p class="text-xs text-muted-foreground">
            Abatido: valor deste mês coberto por crédito de outro mês. Crédito: sobra deste mês após abater atrasos anteriores.
          </p>
        } @else if (summary().unlinkedSessions === 0) {
          <p class="text-sm text-muted-foreground">Nenhum movimento neste mês.</p>
        }
      }
    </section>
  `,
})
export class FinanceComponent {
  private readonly sessionsService = inject(SessionsService);
  private readonly patientsService = inject(PatientsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly allSessions = this.sessionsService.watchAll();

  protected readonly formatCents = formatCents;
  protected readonly unlinkedNote = unlinkedNote;

  readonly month = signal(currentMonth(new Date()));
  readonly expanded = signal<ReadonlySet<string>>(new Set());

  readonly ready = computed(
    () => this.allSessions.loaded() && this.patientsService.loaded() && this.paymentsService.loaded(),
  );
  readonly loadError = computed(
    () => this.allSessions.error() ?? this.patientsService.error() ?? this.paymentsService.error(),
  );

  readonly ledger = computed(() =>
    buildLedger({
      patients: this.patientsService.patients(),
      sessions: this.allSessions.sessions(),
      payments: this.paymentsService.payments(),
    }),
  );
  readonly summary = computed(() => summarizeMonth(this.ledger(), this.month()));

  readonly patientsById = computed(
    () => new Map(this.patientsService.patients().map(patient => [patient.id, patient] as const)),
  );
  readonly rows = computed(() => {
    const hasLinkedSessions = this.summary().hasLinkedSessions;
    return this.summary().lines.map(line => {
      const patient = this.patientsById().get(line.patientId);
      const canCharge = hasLinkedSessions && line.overdue > 0 && patient !== undefined;
      const chargeUrl = canCharge
        ? whatsappChargeUrl(patient.phone, patient.name, line.toReceive + line.overdue)
        : null;
      return {
        line,
        name: patient?.name ?? REMOVED_PATIENT_LABEL,
        pixQuery: pixPrefillQuery(line),
        chargeUrl,
        invalidPhone: canCharge && chargeUrl === null,
      };
    });
  });

  setMonth(value: string): void {
    if (!isValidMonth(value)) return;
    if (value === this.month()) return;
    this.month.set(value);
    this.expanded.set(new Set());
  }

  toggleDetails(patientId: string): void {
    this.expanded.update(current => {
      const next = new Set(current);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }

  protected isExpanded(patientId: string): boolean {
    return this.expanded().has(patientId);
  }

  /** Sem sessão vinculada a paciente no mês o devido é desconhecido, e tudo que deriva dele vira traço (spec §4). Só o recebido é fato. */
  protected valueOrDash(cents: number): string {
    return this.summary().hasLinkedSessions ? formatCents(cents) : '—';
  }
}
