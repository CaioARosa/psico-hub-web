import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideExternalLink, lucideInfo } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { ZardTableImports } from '@/shared/components/table';
import { MonthPickerComponent } from '../month-picker.component';
import { CountUpDirective } from '../motion/count-up.directive';
import { SpotlightDirective } from '../motion/spotlight.directive';
import { ChargesService } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService } from '../data/sessions.service';
import { REMOVED_PATIENT_LABEL, buildLedger, summarizeMonth } from '../domain/finance';
import { whatsappChargeUrl } from '../domain/charge-message';
import { shortDateOf } from '../domain/datetime';
import { currentMonth, isValidMonth } from '../domain/month';
import { formatCents } from '../domain/money';
import { pixPrefillQuery } from '../domain/pix-prefill';
import { unlinkedNote } from '../domain/unlinked-note';

@Component({
  selector: 'app-admin-finance',
  standalone: true,
  imports: [
    RouterLink,
    NgIcon,
    CountUpDirective,
    SpotlightDirective,
    ZardButtonComponent,
    ZardAlertComponent,
    MonthPickerComponent,
    ZardSkeletonComponent,
    ...ZardCardImports,
    ...ZardTableImports,
  ],
  viewProviders: [provideIcons({ lucideInfo, lucideChevronDown, lucideExternalLink })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes fin-rise {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: none; }
      }
      .admin-rows > tr:not(.admin-detail-row) {
        animation: fin-rise 0.3s var(--admin-ease) backwards;
        transition: background-color 0.2s ease;
      }
      .admin-rows > tr:not(.admin-detail-row):nth-child(2) { animation-delay: 28ms; }
      .admin-rows > tr:not(.admin-detail-row):nth-child(3) { animation-delay: 56ms; }
      .admin-rows > tr:not(.admin-detail-row):nth-child(4) { animation-delay: 84ms; }
      .admin-rows > tr:not(.admin-detail-row):nth-child(5) { animation-delay: 112ms; }
      .admin-rows > tr:not(.admin-detail-row):nth-child(n + 6) { animation-delay: 140ms; }
      .admin-detail-row { animation: fin-rise 0.24s var(--admin-ease) backwards; }
      .admin-chevron,
      .admin-ext-hover ng-icon {
        display: inline-flex;
        transition: transform 0.28s var(--admin-spring);
      }
      [aria-expanded='true'] .admin-chevron { transform: rotate(180deg); }
      @media (hover: hover) {
        .admin-ext-hover:hover ng-icon { transform: translate(1.5px, -1.5px); }
      }
    `,
  ],
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Financeiro</h1>
          <p class="text-xs text-muted-foreground mt-0.5">Extrato por paciente, abatimentos e cobrança.</p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <a
            z-button
            zType="outline"
            class="h-10 rounded-xl px-4"
            routerLink="/admin/cobranca"
            [queryParams]="{ mes: month() }"
          >
            Cobrar em fila
          </a>
          <div class="space-y-1.5">
            <label for="finance-month" class="block text-sm font-medium text-foreground">Mês</label>
            <app-month-picker zId="finance-month" [month]="month()" (monthChange)="setMonth($event)" />
          </div>
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
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Recebido</dt>
            <dd class="font-display text-2xl text-primary mt-1 tabular-nums" [appCountUp]="summary().received" [countFormat]="formatCents"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">A receber</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="toReceiveCents()" [countFormat]="formatCents"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Em atraso</dt>
            <dd
              class="font-display text-2xl mt-1 tabular-nums"
              [class.text-destructive]="(overdueCents() ?? 0) > 0"
              [class.text-foreground]="(overdueCents() ?? 0) === 0"
              [appCountUp]="overdueCents()"
              [countFormat]="formatCents"
            ></dd>
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
                <tbody z-table-body class="admin-rows text-foreground tabular-nums">
                  @for (row of rows(); track row.line.patientId) {
                    <tr z-table-row class="hover:bg-[#FDFBF7]/80">
                      <th scope="row" class="px-4 py-3 text-left font-medium">{{ row.name }}</th>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.due) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ formatCents(row.line.received) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.abated) }}</td>
                      <td z-table-cell class="px-4 py-3 text-right">{{ valueOrDash(row.line.toReceive) }}</td>
                      <td
                        z-table-cell
                        class="px-4 py-3 text-right"
                        [class.text-destructive]="summary().hasLinkedSessions && row.line.overdue > 0"
                        [class.font-medium]="summary().hasLinkedSessions && row.line.overdue > 0"
                      >
                        {{ valueOrDash(row.line.overdue) }}
                      </td>
                      <td
                        z-table-cell
                        class="px-4 py-3 text-right"
                        [class.text-primary]="summary().hasLinkedSessions && row.line.credit > 0"
                        [class.font-medium]="summary().hasLinkedSessions && row.line.credit > 0"
                      >
                        {{ valueOrDash(row.line.credit) }}
                      </td>
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
                              <ng-icon name="lucideChevronDown" class="admin-chevron size-3.5" />
                            </button>
                          }
                          @if (row.line.toReceive > 0) {
                            <a z-button zType="outline" zSize="sm" routerLink="/admin/pagamentos" [queryParams]="row.pixQuery">
                              Registrar Pix
                            </a>
                          }
                          @if (row.chargedAt; as chargedAt) {
                            <span class="text-xs text-muted-foreground whitespace-nowrap">
                              Cobrada em {{ shortDate(chargedAt) }}
                            </span>
                          }
                          @if (row.chargeUrl; as url) {
                            <a
                              z-button
                              zType="outline"
                              zSize="sm"
                              class="admin-ext-hover border-[#4D6D66]/30 hover:border-[#4D6D66]/60"
                              [href]="url"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Cobrar no WhatsApp
                              <ng-icon name="lucideExternalLink" class="size-3.5" />
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
                      <tr z-table-row class="admin-detail-row bg-[#FDFBF7]">
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
  private readonly chargesService = inject(ChargesService);
  private readonly allSessions = this.sessionsService.watchAll();

  protected readonly formatCents = formatCents;
  protected readonly shortDate = shortDateOf;
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

  protected readonly toReceiveCents = computed(() =>
    this.summary().hasLinkedSessions ? this.summary().toReceive : null,
  );
  protected readonly overdueCents = computed(() =>
    this.summary().hasLinkedSessions ? this.summary().overdue : null,
  );

  readonly patientsById = computed(
    () => new Map(this.patientsService.patients().map(patient => [patient.id, patient] as const)),
  );
  readonly rows = computed(() => {
    const hasLinkedSessions = this.summary().hasLinkedSessions;
    const charges = this.chargesService.watchMonth(this.month()).charges();
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
        chargedAt: charges.get(line.patientId) ?? null,
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
