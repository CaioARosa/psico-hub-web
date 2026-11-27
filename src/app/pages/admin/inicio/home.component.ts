import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCheckCircle2,
  lucideChevronDown,
  lucideCircle,
  lucideLoader2,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardProgressComponent } from '@/shared/components/progress';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { AdminMonthService } from '../data/admin-month.service';
import { AutoSyncService } from '../data/auto-sync.service';
import { ChargesService } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService } from '../data/sessions.service';
import { buildDashboard, type FrequencyAlert } from '../domain/dashboard';
import { buildLedger, summarizeMonth } from '../domain/finance';
import { isValidMonth, monthLabel } from '../domain/month';
import { formatCents } from '../domain/money';
import { buildWorkflowState } from '../domain/workflow';
import { CountUpDirective } from '../motion/count-up.directive';
import { SpotlightDirective } from '../motion/spotlight.directive';
import { RevenueChartComponent } from '../painel/revenue-chart.component';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [
    RouterLink,
    NgIcon,
    CountUpDirective,
    SpotlightDirective,
    RevenueChartComponent,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardProgressComponent,
    ZardSkeletonComponent,
    ...ZardCardImports,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowRight,
      lucideCheckCircle2,
      lucideChevronDown,
      lucideCircle,
      lucideLoader2,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Início</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            O que precisa da sua atenção e o resumo de {{ monthLabel(month()) }}.
          </p>
        </div>
      </header>

      @if (loadError(); as message) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
      } @else if (!ready()) {
        <div class="space-y-4">
          <p class="text-sm text-muted-foreground">Carregando visão do consultório…</p>
          <z-skeleton class="h-40 w-full rounded-2xl" />
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            @for (i of [1, 2, 3, 4]; track i) {
              <z-skeleton class="h-24 w-full rounded-2xl" />
            }
          </div>
          <z-skeleton class="h-60 w-full rounded-2xl" />
        </div>
      } @else {
        @if (workflow().allClear && !showStepsWhenClear()) {
          <div
            role="status"
            class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#4D6D66]/25 bg-[#D4E6E1]/45 px-5 py-4"
          >
            <div class="flex items-center gap-3">
              <ng-icon name="lucideCheckCircle2" class="size-5 text-primary shrink-0" />
              <div>
                <p class="text-sm font-semibold text-foreground">Tudo em dia em {{ monthLabel(month()) }}</p>
                <p class="text-xs text-muted-foreground">
                  Pacientes cadastrados, agenda sincronizada, atendimentos confirmados e financeiro em ordem.
                </p>
              </div>
            </div>

            <button
              z-button
              zType="outline"
              zSize="sm"
              type="button"
              class="min-h-10 rounded-xl bg-white/80"
              (click)="showStepsWhenClear.set(true)"
            >
              Ver etapas
              <ng-icon name="lucideChevronDown" class="size-3.5" />
            </button>
          </div>
        } @else {
          <z-card class="rounded-2xl p-5 shadow-2xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-foreground">
                  @if (workflow().nextStep; as next) {
                    Próximo passo: {{ next.title }}
                  } @else {
                    Etapas do mês
                  }
                </h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  @if (workflow().nextStep; as next) {
                    {{ next.summary }}
                  } @else {
                    Todas as etapas deste mês estão concluídas.
                  }
                </p>
              </div>

              @if (workflow().nextStep; as next) {
                @if (next.status !== 'in_progress') {
                  <a
                    z-button
                    class="min-h-11 rounded-xl px-4"
                    [routerLink]="next.route"
                    [queryParams]="next.queryParams"
                  >
                    {{ next.ctaLabel }}
                    <ng-icon name="lucideArrowRight" class="size-4" />
                  </a>
                }
              } @else {
                <button
                  z-button
                  zType="ghost"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-xl"
                  (click)="showStepsWhenClear.set(false)"
                >
                  Recolher
                </button>
              }
            </div>

            <ol class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              @for (step of workflow().steps; track step.id) {
                <li
                  class="rounded-xl border p-3.5 flex flex-col justify-between gap-2 transition-colors"
                  [class.border-[#4D6D66]/45]="workflow().nextStep?.id === step.id"
                  [class.bg-[#FDFBF7]]="workflow().nextStep?.id === step.id"
                  [class.border-border/80]="workflow().nextStep?.id !== step.id"
                  [class.bg-white]="workflow().nextStep?.id !== step.id"
                >
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-medium text-muted-foreground">Passo {{ step.index }}</span>
                      @if (step.status === 'done') {
                        <ng-icon name="lucideCheckCircle2" class="size-4 text-primary" aria-label="Concluído" />
                      } @else if (step.status === 'in_progress') {
                        <ng-icon name="lucideLoader2" class="size-4 text-primary animate-spin" aria-label="Em andamento" />
                      } @else {
                        <ng-icon name="lucideCircle" class="size-4 text-muted-foreground/50" aria-label="Pendente" />
                      }
                    </div>
                    <p class="text-sm font-medium text-foreground">{{ step.title }}</p>
                    <p class="text-xs text-muted-foreground leading-relaxed">{{ step.summary }}</p>
                  </div>

                  @if (step.status !== 'in_progress') {
                    <a
                      [routerLink]="step.route"
                      [queryParams]="step.queryParams"
                      class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4 pt-1"
                    >
                      {{ step.ctaLabel }}
                      <ng-icon name="lucideArrowRight" class="size-3" />
                    </a>
                  }
                </li>
              }
            </ol>
          </z-card>
        }

        @if (!dashboard().hasSessions && autoSync.syncing()) {
          <div
            role="status"
            class="flex items-center gap-2.5 rounded-xl border border-border bg-[#FDFBF7] px-4 py-3 text-sm text-muted-foreground"
          >
            <ng-icon name="lucideLoader2" class="size-4 animate-spin text-primary shrink-0" />
            <span>Buscando sessões no Google Agenda…</span>
          </div>
        }

        <dl class="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-list">
          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Recebido</dt>
            <dd
              class="font-display text-2xl text-primary mt-1 tabular-nums"
              [appCountUp]="summary().received"
              [countFormat]="formatCents"
            ></dd>
          </div>

          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">A receber</dt>
            <dd
              class="font-display text-2xl text-foreground mt-1 tabular-nums"
              [appCountUp]="toReceiveCents()"
              [countFormat]="formatCents"
            ></dd>
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

          <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4">
            <dt class="text-xs font-medium text-muted-foreground">Sessões realizadas</dt>
            <dd class="font-display text-2xl text-foreground mt-1 tabular-nums">
              {{ dashboard().done }}
              <span class="text-xs font-sans font-normal text-muted-foreground">
                · {{ dashboard().patientsAttended }} {{ dashboard().patientsAttended === 1 ? 'paciente' : 'pacientes' }}
              </span>
            </dd>
          </div>
        </dl>

        @if (forecastPercent() !== null) {
          <section aria-labelledby="forecast-title">
            <z-card class="rounded-2xl p-5 space-y-3 shadow-2xs">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 id="forecast-title" class="text-base font-medium text-foreground">Previsto × Realizado</h2>
                <z-badge zType="secondary" class="tabular-nums bg-[#D4E6E1]/60 text-[#1C221F]">
                  {{ Math.round(forecastPercent()!) }}%
                </z-badge>
              </div>
              <dl class="flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <dt class="text-xs text-muted-foreground">Realizado</dt>
                  <dd class="font-display text-xl text-foreground tabular-nums">{{ formatCents(dueCents()!) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Previsto</dt>
                  <dd class="font-display text-xl text-foreground tabular-nums">{{ formatCents(expectedCents()!) }}</dd>
                </div>
              </dl>
              <z-progress [value]="forecastPercent()!" aria-hidden="true" class="h-2.5 bg-[#D4E6E1]/50" />
            </z-card>
          </section>
        }

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section aria-labelledby="chart-title" class="lg:col-span-2">
            <z-card class="rounded-2xl p-5 space-y-3 shadow-2xs h-full">
              <h2 id="chart-title" class="text-base font-medium text-foreground">Recebido e devido nos últimos 6 meses</h2>
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
            <z-card class="rounded-2xl p-5 space-y-3 shadow-2xs h-full">
              <div class="flex items-center justify-between gap-2">
                <h2 id="alerts-title" class="text-base font-medium text-foreground">Alertas de frequência</h2>
                @if (dashboard().alerts.length > 0) {
                  <z-badge zType="secondary" class="tabular-nums">{{ dashboard().alerts.length }}</z-badge>
                }
              </div>
              <p class="text-xs text-muted-foreground">
                Compara o contratado no mês com as sessões realizadas e agendadas.
              </p>

              @if (dashboard().alerts.length > 0) {
                <ul class="space-y-1.5 text-sm text-foreground">
                  @for (alert of dashboard().alerts; track alert.patientId) {
                    <li class="py-2 px-3 rounded-xl bg-[#FDFBF7] border border-border/70 tabular-nums">
                      {{ alertText(alert) }}
                    </li>
                  }
                </ul>
              } @else if (!dashboard().hasLinkedSessions) {
                <p class="text-sm text-muted-foreground">Sem sessões vinculadas neste mês para avaliar.</p>
              } @else {
                <p class="text-sm text-muted-foreground">Nenhum alerta de frequência neste mês.</p>
              }
            </z-card>
          </section>
        </div>
      }
    </section>
  `,
})
export class HomeComponent {
  private readonly adminMonth = inject(AdminMonthService);
  protected readonly autoSync = inject(AutoSyncService);
  private readonly sessionsService = inject(SessionsService);
  private readonly patientsService = inject(PatientsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly chargesService = inject(ChargesService);
  private readonly route = inject(ActivatedRoute, { optional: true });

  private readonly allSessions = this.sessionsService.watchAll();
  private readonly now = new Date();

  protected readonly Math = Math;
  protected readonly formatCents = formatCents;
  protected readonly monthLabel = monthLabel;
  protected readonly month = this.adminMonth.month;
  protected readonly showStepsWhenClear = signal(false);

  constructor() {
    const queryMes = this.route?.snapshot?.queryParamMap?.get('mes');
    if (queryMes && isValidMonth(queryMes)) {
      this.adminMonth.setMonth(queryMes);
    }
  }

  protected readonly ready = computed(
    () => this.allSessions.loaded() && this.patientsService.loaded() && this.paymentsService.loaded(),
  );
  protected readonly loadError = computed(
    () => this.allSessions.error() ?? this.patientsService.error() ?? this.paymentsService.error(),
  );

  private readonly ledger = computed(() =>
    buildLedger({
      patients: this.patientsService.patients(),
      sessions: this.allSessions.sessions(),
      payments: this.paymentsService.payments(),
    }),
  );

  protected readonly summary = computed(() => summarizeMonth(this.ledger(), this.month()));

  protected readonly dashboard = computed(() =>
    buildDashboard({
      ledger: this.ledger(),
      patients: this.patientsService.patients(),
      sessions: this.allSessions.sessions(),
      month: this.month(),
      now: this.now,
    }),
  );

  protected readonly workflow = computed(() =>
    buildWorkflowState({
      patients: this.patientsService.patients(),
      sessions: this.allSessions.sessions(),
      summary: this.summary(),
      charges: this.chargesService.watchMonth(this.month()).charges(),
      month: this.month(),
      now: this.now,
      syncing: this.autoSync.syncing(),
      lastSyncedAt: this.autoSync.lastSyncedAt(),
    }),
  );

  protected readonly dueCents = computed(() =>
    this.dashboard().hasLinkedSessions ? this.dashboard().due : null,
  );
  protected readonly expectedCents = computed(() =>
    this.dashboard().hasLinkedSessions ? this.dashboard().expected : null,
  );
  protected readonly toReceiveCents = computed(() =>
    this.summary().hasLinkedSessions ? this.summary().toReceive : null,
  );
  protected readonly overdueCents = computed(() =>
    this.summary().hasLinkedSessions ? this.summary().overdue : null,
  );
  protected readonly forecastPercent = computed(() => {
    const { hasLinkedSessions, due, expected } = this.dashboard();
    if (!hasLinkedSessions || expected <= 0) return null;
    return Math.min(100, (due / expected) * 100);
  });

  protected alertText(alert: FrequencyAlert): string {
    const unit = this.dashboard().countsScheduled ? 'previstas' : 'realizadas';
    const gap = alert.difference < 0 ? `falta ${-alert.difference}` : `sobra ${alert.difference}`;
    return `${alert.name}: contratado ${alert.contracted}, ${unit} ${alert.counted} (${gap})`;
  }
}
