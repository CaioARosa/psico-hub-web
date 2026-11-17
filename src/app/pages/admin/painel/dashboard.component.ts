import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService } from '../data/sessions.service';
import { buildDashboard } from '../domain/dashboard';
import type { FrequencyAlert } from '../domain/dashboard';
import { buildLedger } from '../domain/finance';
import { currentMonth, isValidMonth, monthLabel } from '../domain/month';
import { formatCents } from '../domain/money';
import { RevenueChartComponent } from './revenue-chart.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RevenueChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="font-display text-2xl text-[#1C221F] tracking-tight">Painel</h1>

        <div class="space-y-1.5">
          <label for="dashboard-month" class="block text-sm font-medium text-[#1C221F]">Mês</label>
          <input
            #monthInput
            id="dashboard-month"
            name="month"
            type="month"
            class="min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [value]="month()"
            (change)="setMonth($any($event.target).value)"
          />
        </div>
      </header>

      @if (loadError(); as message) {
        <p role="alert" class="text-sm text-red-700">{{ message }}</p>
      } @else if (!ready()) {
        <p class="text-sm text-[#556661]">Carregando painel...</p>
      } @else {
        @if (!dashboard().hasSessions) {
          <p role="status" class="text-sm rounded-xl bg-amber-100 border border-amber-300 px-3.5 py-2.5 text-amber-900">
            Sincronize a agenda deste mês para ver o devido.
          </p>
        }
        @if (dashboard().unlinkedSessions > 0) {
          <p role="status" class="text-sm rounded-xl bg-amber-100 border border-amber-300 px-3.5 py-2.5 text-amber-900">
            {{ unlinkedNote(dashboard().unlinkedSessions) }}
          </p>
        }

        <dl class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Pacientes atendidos</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ dashboard().patientsAttended }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Realizadas</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ dashboard().done }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Faltas</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ dashboard().noShow }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Cancelamentos</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ dashboard().cancelled }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Recebido</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ formatCents(dashboard().received) }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Devido</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ dueOrDash() }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4 col-span-2">
            <dt class="text-sm text-[#556661]">Previsto (acordos atuais)</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ formatCents(dashboard().expected) }}</dd>
          </div>
        </dl>

        <section
          aria-labelledby="forecast-title"
          class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4 space-y-3"
        >
          <h2 id="forecast-title" class="text-base font-medium text-[#1C221F]">Previsto × Realizado</h2>
          <dl class="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt class="text-sm text-[#556661]">Realizado</dt>
              <dd class="font-display text-xl text-[#1C221F]">{{ dueOrDash() }}</dd>
            </div>
            <div>
              <dt class="text-sm text-[#556661]">Previsto</dt>
              <dd class="font-display text-xl text-[#1C221F]">{{ formatCents(dashboard().expected) }}</dd>
            </div>
          </dl>
          @if (forecastPercent() !== null) {
            <div aria-hidden="true" class="h-2.5 w-full rounded-full bg-[#D4E6E1]/60 overflow-hidden">
              <div class="h-full rounded-full bg-[#4D6D66]" [style.width.%]="forecastPercent()"></div>
            </div>
          }
        </section>

        <section
          aria-labelledby="chart-title"
          class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4 space-y-3"
        >
          <h2 id="chart-title" class="text-base font-medium text-[#1C221F]">Recebido e devido por mês</h2>
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
        </section>

        <section
          aria-labelledby="alerts-title"
          class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4 space-y-3"
        >
          <h2 id="alerts-title" class="text-base font-medium text-[#1C221F]">Alertas de frequência</h2>
          @if (dashboard().alerts.length > 0) {
            <ul class="space-y-1 text-sm text-[#1C221F]">
              @for (alert of dashboard().alerts; track alert.patientId) {
                <li>{{ alertText(alert) }}</li>
              }
            </ul>
          } @else {
            <p class="text-sm text-[#556661]">Nenhum alerta de frequência neste mês</p>
          }
        </section>
      }
    </section>
  `,
})
export class DashboardComponent {
  private readonly sessionsService = inject(SessionsService);
  private readonly patientsService = inject(PatientsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly allSessions = this.sessionsService.watchAll();
  private readonly now = new Date();

  protected readonly formatCents = formatCents;
  protected readonly monthLabel = monthLabel;

  readonly month = signal(currentMonth(this.now));
  private readonly monthInput = viewChild<ElementRef<HTMLInputElement>>('monthInput');

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

  /** Só visual: proporção do realizado sobre o previsto, limitada a 100%; sem barra quando o devido é traço ou o previsto é zero. */
  protected readonly forecastPercent = computed(() => {
    const { hasLinkedSessions, due, expected } = this.dashboard();
    if (!hasLinkedSessions || expected <= 0) return null;
    return Math.min(100, (due / expected) * 100);
  });

  setMonth(value: string): void {
    if (!isValidMonth(value)) {
      const input = this.monthInput();
      if (input) input.nativeElement.value = this.month();
      return;
    }
    if (value === this.month()) return;
    this.month.set(value);
  }

  /** Sem sessão vinculada a paciente no mês o devido é desconhecido e vira traço (spec §4). */
  protected dueOrDash(): string {
    const { hasLinkedSessions, due } = this.dashboard();
    return hasLinkedSessions ? formatCents(due) : '—';
  }

  protected alertText(alert: FrequencyAlert): string {
    const unit = this.dashboard().countsScheduled ? 'previstas' : 'realizadas';
    const gap =
      alert.difference < 0 ? `falta ${-alert.difference}` : `sobra ${alert.difference}`;
    return `${alert.name}: contratado ${alert.contracted}, ${unit} ${alert.counted} (${gap})`;
  }

  /** Sessões sem paciente ficam fora dos valores (spec §3); a nota diz quantas são. */
  protected unlinkedNote(count: number): string {
    return count === 1
      ? '1 sessão sem paciente neste mês. Vincule-a na tela Sessões para entrar no cálculo.'
      : `${count} sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.`;
  }
}
