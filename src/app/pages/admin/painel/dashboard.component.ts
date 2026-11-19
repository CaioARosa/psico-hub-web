import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideInfo } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardCardImports } from '@/shared/components/card';
import { ZardProgressComponent } from '@/shared/components/progress';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { CalendarSyncsService } from '../data/calendar-syncs.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService } from '../data/sessions.service';
import { buildDashboard } from '../domain/dashboard';
import type { FrequencyAlert } from '../domain/dashboard';
import { buildLedger } from '../domain/finance';
import { currentMonth, isValidMonth, monthLabel } from '../domain/month';
import { formatCents } from '../domain/money';
import { syncFreshness, syncFreshnessNote } from '../domain/sync-freshness';
import { unlinkedNote } from '../domain/unlinked-note';
import { MonthPickerComponent } from '../month-picker.component';
import { CountUpDirective } from '../motion/count-up.directive';
import { canAnimateMotion } from '../motion/reduced-motion';
import { SpotlightDirective } from '../motion/spotlight.directive';
import { RevenueChartComponent } from './revenue-chart.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    NgIcon,
    RevenueChartComponent,
    RouterLink,
    CountUpDirective,
    SpotlightDirective,
    ZardAlertComponent,
    ZardBadgeComponent,
    MonthPickerComponent,
    ZardProgressComponent,
    ZardSkeletonComponent,
    ...ZardCardImports,
  ],
  viewProviders: [provideIcons({ lucideInfo, lucideArrowRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes dash-pulse-dot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.85); }
      }
      .admin-status-dot { animation: dash-pulse-dot 2s ease-in-out infinite; }
      .admin-arrow-hover ng-icon { display: inline-flex; transition: transform 0.28s var(--admin-spring); }
      @media (hover: hover) {
        .admin-arrow-hover:hover ng-icon { transform: translateX(3px); }
      }
    `,
  ],
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Painel</h1>
          <p class="text-xs text-muted-foreground mt-0.5">Visão clínica e financeira do mês selecionado.</p>
        </div>

        <div class="space-y-1.5">
          <label for="dashboard-month" class="block text-sm font-medium text-foreground">Mês</label>
          <app-month-picker zId="dashboard-month" [month]="month()" (monthChange)="setMonth($event)" />
        </div>
      </header>

      @if (loadError(); as message) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
      } @else if (!ready()) {
        <div class="space-y-4">
          <p class="text-sm text-muted-foreground">Carregando painel...</p>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            @for (i of [1, 2, 3, 4, 5, 6]; track i) {
              <z-skeleton class="h-22 w-full rounded-2xl" />
            }
            <z-skeleton class="h-22 w-full rounded-2xl col-span-2" />
          </div>
          <z-skeleton class="h-64 w-full rounded-2xl" />
        </div>
      } @else {
        @if (!dashboard().hasSessions) {
          <z-alert
            zRole="status"
            zIcon="lucideInfo"
            class="bg-amber-50 border-amber-300/70 text-amber-950 rounded-xl"
            zDescription="Sincronize a agenda deste mês para ver o devido."
          />
        }
        @if (dashboard().unlinkedSessions > 0) {
          <z-alert
            zRole="status"
            zIcon="lucideInfo"
            class="bg-amber-50 border-amber-300/70 text-amber-950 rounded-xl"
            [zDescription]="unlinkedNote(dashboard().unlinkedSessions)"
          />
        }

        <dl class="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-list">
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Pacientes atendidos</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="dashboard().patientsAttended" [countFormat]="formatCount"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Realizadas</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="dashboard().done" [countFormat]="formatCount"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Faltas</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="dashboard().noShow" [countFormat]="formatCount"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Cancelamentos</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="dashboard().cancelled" [countFormat]="formatCount"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Recebido</dt>
            <dd class="font-display text-2xl text-primary mt-1 tabular-nums" [appCountUp]="dashboard().received" [countFormat]="formatCents"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Devido</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="dueCents()" [countFormat]="formatCents"></dd>
          </div>
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4 col-span-2">
            <dt class="text-xs font-medium text-muted-foreground">Previsto (acordos atuais)</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums" [appCountUp]="dashboard().expected" [countFormat]="formatCents"></dd>
          </div>
        </dl>

        <section aria-labelledby="forecast-title">
          <z-card class="rounded-2xl p-5 space-y-3 shadow-2xs">
            <div class="flex items-center justify-between gap-2">
              <h2 id="forecast-title" class="text-base font-medium text-foreground">Previsto × Realizado</h2>
              @if (forecastPercent() !== null) {
                <z-badge zType="secondary" class="tabular-nums bg-[#D4E6E1]/60 text-[#1C221F]">
                  <span [appCountUp]="forecastPercent()" [countFormat]="formatPercent"></span>
                </z-badge>
              }
            </div>
            <dl class="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <dt class="text-xs text-muted-foreground">Realizado</dt>
                <dd class="font-display text-xl text-foreground tabular-nums" [appCountUp]="dueCents()" [countFormat]="formatCents"></dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">Previsto</dt>
                <dd class="font-display text-xl text-foreground tabular-nums" [appCountUp]="dashboard().expected" [countFormat]="formatCents"></dd>
              </div>
            </dl>
            @if (forecastPercent() !== null) {
              <z-progress [value]="forecastShown()" aria-hidden="true" class="h-2.5 bg-[#D4E6E1]/50" />
            }
          </z-card>
        </section>

        <section aria-labelledby="chart-title">
          <z-card class="rounded-2xl p-5 space-y-3 shadow-2xs">
            <h2 id="chart-title" class="text-base font-medium text-foreground">Recebido e devido por mês</h2>
            <app-revenue-chart [series]="dashboard().series" />
            <table class="sr-only">
              <caption>Recebido e devido nos últimos 6 meses</caption>
              <thead>
                <tr>
                  <th scope="col">Mês</th>
                  <th scope="col">Recebido</th>
                  <th scope="col">Devido</th>
                </tr>
              </thead>
              <tbody>
                @for (point of dashboard().series; track point.month) {
                  <tr>
                    <th scope="row">{{ monthLabel(point.month) }}</th>
                    <td>{{ formatCents(point.received) }}</td>
                    <td>{{ formatCents(point.due) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </z-card>
        </section>

        <section aria-labelledby="alerts-title">
          <z-card class="rounded-2xl p-5 space-y-3 shadow-2xs">
            <div class="flex items-center justify-between gap-2">
              <h2 id="alerts-title" class="text-base font-medium text-foreground">Alertas de frequência</h2>
              @if (dashboard().alerts.length > 0) {
                <z-badge zType="secondary" class="admin-pop tabular-nums">{{ dashboard().alerts.length }}</z-badge>
              }
            </div>
            <p class="text-xs text-muted-foreground">
              No mês atual e futuros, soma realizadas + agendadas; em meses passados, apenas realizadas.
            </p>
            @if (syncNote(); as note) {
              @if (note.warn) {
                <div role="status" class="admin-pane text-sm rounded-xl bg-amber-50 border border-amber-300/70 text-amber-950 px-3.5 py-2.5 space-y-1.5">
                  <p class="flex items-center gap-2">
                    <span class="admin-status-dot inline-block size-2 rounded-full bg-amber-600 shrink-0" aria-hidden="true"></span>
                    <span>{{ note.text }}</span>
                  </p>
                  <a routerLink="/admin/sessoes" class="admin-arrow-hover inline-flex items-center gap-1 font-medium underline underline-offset-2">
                    Ir para Sessões
                    <ng-icon name="lucideArrowRight" class="size-3.5" />
                  </a>
                </div>
              } @else {
                <p class="text-xs text-muted-foreground">{{ note.text }}</p>
              }
            }
            @if (dashboard().alerts.length > 0) {
              <ul class="space-y-1.5 text-sm text-foreground stagger-list">
                @for (alert of dashboard().alerts; track alert.patientId) {
                  <li class="py-1.5 px-3 rounded-lg bg-[#FDFBF7] border border-border/70 hover:border-[#4D6D66]/35 hover:bg-[#F5F2ED]/60 transition-colors tabular-nums">
                    {{ alertText(alert) }}
                  </li>
                }
              </ul>
            } @else if (!dashboard().hasLinkedSessions) {
              <p class="text-sm text-muted-foreground">Sem sessões vinculadas neste mês para avaliar a frequência.</p>
            } @else {
              <p class="text-sm text-muted-foreground">Nenhum alerta de frequência neste mês</p>
            }
          </z-card>
        </section>
      }
    </section>
  `,
})
export class DashboardComponent {
  private readonly sessionsService = inject(SessionsService);
  private readonly patientsService = inject(PatientsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly calendarSyncs = inject(CalendarSyncsService);
  private readonly allSessions = this.sessionsService.watchAll();
  private readonly now = new Date();
  private progressFrame = 0;

  protected readonly formatCents = formatCents;
  protected readonly formatCount = (value: number): string => String(value);
  protected readonly formatPercent = (value: number): string => `${Math.round(value)}%`;
  protected readonly monthLabel = monthLabel;
  protected readonly unlinkedNote = unlinkedNote;

  readonly month = signal(currentMonth(this.now));
  protected readonly forecastShown = signal(0);

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
  readonly dashboard = computed(() =>
    buildDashboard({
      ledger: this.ledger(),
      patients: this.patientsService.patients(),
      sessions: this.allSessions.sessions(),
      month: this.month(),
      now: this.now,
    }),
  );

  /** Sem sessão vinculada a paciente no mês o devido é desconhecido e vira traço (spec §4). */
  protected readonly dueCents = computed(() => {
    const { hasLinkedSessions, due } = this.dashboard();
    return hasLinkedSessions ? due : null;
  });

  /** Aviso sobre a última sincronização: sem ela, agendadas recentes faltam na contagem e geram "falta" falsa. */
  protected readonly syncNote = computed(() =>
    syncFreshnessNote(
      syncFreshness({
        month: this.month(),
        now: this.now,
        lastSyncedAt: this.calendarSyncs.watchMonth(this.month()).lastSyncedAt(),
      }),
    ),
  );

  /** Só visual: proporção do realizado sobre o previsto, limitada a 100%; sem barra quando o devido é traço ou o previsto é zero. */
  protected readonly forecastPercent = computed(() => {
    const { hasLinkedSessions, due, expected } = this.dashboard();
    if (!hasLinkedSessions || expected <= 0) return null;
    return Math.min(100, (due / expected) * 100);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.progressFrame && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.progressFrame);
      }
      this.progressFrame = 0;
    });

    effect(() => {
      const target = this.forecastPercent();
      if (this.progressFrame && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.progressFrame);
        this.progressFrame = 0;
      }
      if (target === null) {
        this.forecastShown.set(0);
        return;
      }
      if (!canAnimateMotion() || this.forecastShown() > 0) {
        this.forecastShown.set(target);
        return;
      }
      this.progressFrame = requestAnimationFrame(() => {
        this.progressFrame = 0;
        this.forecastShown.set(target);
      });
    });
  }

  setMonth(value: string): void {
    if (!isValidMonth(value)) return;
    if (value === this.month()) return;
    this.month.set(value);
  }

  protected alertText(alert: FrequencyAlert): string {
    const unit = this.dashboard().countsScheduled ? 'previstas' : 'realizadas';
    const gap =
      alert.difference < 0 ? `falta ${-alert.difference}` : `sobra ${alert.difference}`;
    return `${alert.name}: contratado ${alert.contracted}, ${unit} ${alert.counted} (${gap})`;
  }
}
