import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService } from '../data/sessions.service';
import { REMOVED_PATIENT_LABEL, buildLedger, summarizeMonth } from '../domain/finance';
import { totalsOf } from '../domain/finance-view';
import { currentMonth, isValidMonth } from '../domain/month';
import { formatCents } from '../domain/money';
import { pixPrefillQuery } from '../domain/pix-prefill';

@Component({
  selector: 'app-admin-finance',
  standalone: true,
  imports: [ZardButtonComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="font-display text-2xl text-[#1C221F] tracking-tight">Financeiro</h1>

        <div class="space-y-1.5">
          <label for="finance-month" class="block text-sm font-medium text-[#1C221F]">Mês</label>
          <input
            id="finance-month"
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
        <p class="text-sm text-[#556661]">Carregando financeiro...</p>
      } @else {
        @if (!summary().hasSessions) {
          <p role="status" class="text-sm rounded-xl bg-amber-100 border border-amber-300 px-3.5 py-2.5 text-amber-900">
            Sincronize a agenda deste mês para ver o devido.
          </p>
        }

        <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Recebido</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ formatCents(summary().received) }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">A receber</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ toReceiveLabel(summary().toReceive) }}</dd>
          </div>
          <div class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4">
            <dt class="text-sm text-[#556661]">Em atraso</dt>
            <dd class="font-display text-2xl text-[#1C221F] mt-1">{{ formatCents(summary().overdue) }}</dd>
          </div>
        </dl>

        @if (rows().length === 0) {
          <p class="text-sm text-[#556661]">Nenhum movimento neste mês.</p>
        } @else {
          <div class="overflow-x-auto bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm">
            <table class="w-full min-w-[44rem] text-sm">
              <thead class="text-[#556661] border-b border-[#4C645B]/15">
                <tr>
                  <th scope="col" class="px-4 py-2.5 text-left font-medium">Paciente</th>
                  <th scope="col" class="px-4 py-2.5 text-right font-medium">Devido</th>
                  <th scope="col" class="px-4 py-2.5 text-right font-medium">Recebido</th>
                  <th scope="col" class="px-4 py-2.5 text-right font-medium">Abatido</th>
                  <th scope="col" class="px-4 py-2.5 text-right font-medium">A receber</th>
                  <th scope="col" class="px-4 py-2.5 text-right font-medium">Em atraso</th>
                  <th scope="col" class="px-4 py-2.5 text-right font-medium">Crédito</th>
                  <th scope="col" class="px-4 py-2.5"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#4C645B]/10 text-[#1C221F]">
                @for (row of rows(); track row.line.patientId) {
                  <tr>
                    <th scope="row" class="px-4 py-2.5 text-left font-medium">{{ row.name }}</th>
                    <td class="px-4 py-2.5 text-right">{{ formatCents(row.line.due) }}</td>
                    <td class="px-4 py-2.5 text-right">{{ formatCents(row.line.received) }}</td>
                    <td class="px-4 py-2.5 text-right">{{ formatCents(row.line.abated) }}</td>
                    <td class="px-4 py-2.5 text-right">{{ toReceiveLabel(row.line.toReceive) }}</td>
                    <td class="px-4 py-2.5 text-right">{{ formatCents(row.line.overdue) }}</td>
                    <td class="px-4 py-2.5 text-right">{{ formatCents(row.line.credit) }}</td>
                    <td class="px-4 py-2.5">
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
                      </div>
                    </td>
                  </tr>
                  @if (isExpanded(row.line.patientId)) {
                    <tr class="bg-[#FDFBF7]">
                      <td colspan="8" class="px-4 py-3 text-sm text-[#556661]">
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
              <tfoot class="border-t border-[#4C645B]/15 font-medium text-[#1C221F]">
                <tr>
                  <th scope="row" class="px-4 py-2.5 text-left">Total</th>
                  <td class="px-4 py-2.5 text-right">{{ formatCents(total().due) }}</td>
                  <td class="px-4 py-2.5 text-right">{{ formatCents(total().received) }}</td>
                  <td class="px-4 py-2.5 text-right">{{ formatCents(total().abated) }}</td>
                  <td class="px-4 py-2.5 text-right">{{ toReceiveLabel(total().toReceive) }}</td>
                  <td class="px-4 py-2.5 text-right">{{ formatCents(total().overdue) }}</td>
                  <td class="px-4 py-2.5 text-right">{{ formatCents(total().credit) }}</td>
                  <td class="px-4 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
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
  readonly total = computed(() => totalsOf(this.summary().lines));

  readonly patientNames = computed(
    () => new Map(this.patientsService.patients().map(patient => [patient.id, patient.name] as const)),
  );
  readonly rows = computed(() =>
    this.summary().lines.map(line => ({
      line,
      name: this.patientNames().get(line.patientId) ?? REMOVED_PATIENT_LABEL,
      pixQuery: pixPrefillQuery(line),
    })),
  );

  setMonth(value: string): void {
    if (!isValidMonth(value) || value === this.month()) return;
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

  /** Sem sessões no mês o devido é desconhecido: mostra traço em vez de zero (spec §4). */
  protected toReceiveLabel(cents: number): string {
    return this.summary().hasSessions ? formatCents(cents) : '—';
  }
}
