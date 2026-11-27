import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideExternalLink,
  lucideInfo,
  lucidePlus,
  lucideWallet,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent, type ZardBadgeTypeVariants } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { CobrancaComponent } from '../cobranca/cobranca.component';
import { AdminMonthService } from '../data/admin-month.service';
import { ChargesService } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import { buildChargeQueue } from '../domain/charge-queue';
import { shortDateOf } from '../domain/datetime';
import { buildLedger, summarizeMonth } from '../domain/finance';
import { formatCents } from '../domain/money';
import { isValidMonth, monthLabel } from '../domain/month';
import { parsePixPrefill, type PixPrefill } from '../domain/pix-prefill';
import { unlinkedNote } from '../domain/unlinked-note';
import { buildFinanceRows, type FinanceDisplayRow, type FinanceRowStatus } from '../domain/workflow';
import { CountUpDirective } from '../motion/count-up.directive';
import { prefersReducedMotion } from '../motion/reduced-motion';
import { SpotlightDirective } from '../motion/spotlight.directive';
import { PaymentFormComponent } from '../pagamentos/payment-form.component';
import { PaymentsComponent } from '../pagamentos/payments.component';

export type FinanceTab = 'resumo' | 'cobrar' | 'pix';
export type FinanceFilter = 'pending' | 'all' | 'paid';

function parseTab(raw: string | null | undefined): FinanceTab {
  if (raw === 'cobrar' || raw === 'pix') return raw;
  return 'resumo';
}

@Component({
  selector: 'app-admin-finance-hub',
  standalone: true,
  imports: [
    RouterLink,
    NgIcon,
    CountUpDirective,
    SpotlightDirective,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardEmptyComponent,
    ZardSkeletonComponent,
    PaymentFormComponent,
    CobrancaComponent,
    PaymentsComponent,
    ...ZardCardImports,
  ],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideExternalLink,
      lucideInfo,
      lucidePlus,
      lucideWallet,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Financeiro</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            Quem pagou, quem falta pagar e cobrança em {{ monthLabel(month()) }}.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Seções do financeiro"
            class="inline-flex items-center rounded-xl border border-border bg-card p-1 gap-1"
          >
            <button
              role="tab"
              type="button"
              [attr.aria-selected]="activeTab() === 'resumo'"
              (click)="setTab('resumo')"
              class="min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors"
              [class.bg-[#4D6D66]]="activeTab() === 'resumo'"
              [class.text-white]="activeTab() === 'resumo'"
              [class.text-muted-foreground]="activeTab() !== 'resumo'"
              [class.hover:text-foreground]="activeTab() !== 'resumo'"
            >
              Resumo
            </button>

            <button
              role="tab"
              type="button"
              [attr.aria-selected]="activeTab() === 'cobrar'"
              (click)="setTab('cobrar')"
              class="inline-flex items-center gap-1.5 min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors"
              [class.bg-[#4D6D66]]="activeTab() === 'cobrar'"
              [class.text-white]="activeTab() === 'cobrar'"
              [class.text-muted-foreground]="activeTab() !== 'cobrar'"
              [class.hover:text-foreground]="activeTab() !== 'cobrar'"
            >
              <span>Cobrar</span>
              @if (chargeableCount() > 0) {
                <span
                  class="inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
                  [class.bg-white/20]="activeTab() === 'cobrar'"
                  [class.text-white]="activeTab() === 'cobrar'"
                  [class.bg-red-100]="activeTab() !== 'cobrar'"
                  [class.text-red-800]="activeTab() !== 'cobrar'"
                >
                  {{ chargeableCount() }}
                </span>
              }
            </button>

            <button
              role="tab"
              type="button"
              [attr.aria-selected]="activeTab() === 'pix'"
              (click)="setTab('pix')"
              class="min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors"
              [class.bg-[#4D6D66]]="activeTab() === 'pix'"
              [class.text-white]="activeTab() === 'pix'"
              [class.text-muted-foreground]="activeTab() !== 'pix'"
              [class.hover:text-foreground]="activeTab() !== 'pix'"
            >
              Pix recebidos
            </button>
          </div>

          <button
            z-button
            type="button"
            class="min-h-11 rounded-xl px-4"
            [zDisabled]="pixFormOpen()"
            (click)="openPixForm(null)"
          >
            <ng-icon name="lucidePlus" class="size-4" />
            Registrar Pix
          </button>
        </div>
      </header>

      @if (pixError(); as err) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="err" />
      }

      @if (pixFormOpen() && patientsService.loaded()) {
        <div #formHost class="admin-form-in">
          <app-payment-form
            [prefill]="pixPrefill()"
            [onFailed]="reportPixFailure"
            (saved)="onPixSaved()"
            (cancelled)="closePixForm()"
          />
        </div>
      }

      @if (activeTab() === 'cobrar') {
        <app-admin-cobranca [embedded]="true" [externalMonth]="month()" />
      } @else if (activeTab() === 'pix') {
        <app-admin-payments [embedded]="true" [externalMonth]="month()" />
      } @else {
        @if (loadError(); as message) {
          <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
        } @else if (!ready()) {
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">Carregando financeiro…</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              @for (i of [1, 2, 3]; track i) {
                <z-skeleton class="h-22 w-full rounded-2xl" />
              }
            </div>
            <z-skeleton class="h-44 w-full rounded-2xl" />
          </div>
        } @else {
          @if (summary().unlinkedSessions > 0) {
            <div
              role="status"
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <span>{{ unlinkedNote(summary().unlinkedSessions) }}</span>
              <a
                routerLink="/admin/atendimentos"
                [queryParams]="{ aba: 'pendencias' }"
                class="font-medium underline underline-offset-4"
              >
                Resolver pendências
              </a>
            </div>
          }

          <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-list">
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
            <div appSpotlight class="bg-card rounded-2xl border border-border shadow-2xs p-4 flex items-end justify-between gap-2">
              <div>
                <dt class="text-xs font-medium text-muted-foreground">Em atraso</dt>
                <dd
                  class="font-display text-2xl mt-1 tabular-nums"
                  [class.text-destructive]="(overdueCents() ?? 0) > 0"
                  [class.text-foreground]="(overdueCents() ?? 0) === 0"
                  [appCountUp]="overdueCents()"
                  [countFormat]="formatCents"
                ></dd>
              </div>
              @if (chargeableCount() > 0) {
                <button
                  z-button
                  zType="outline"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-xl"
                  (click)="setTab('cobrar')"
                >
                  Cobrar em fila ({{ chargeableCount() }})
                </button>
              }
            </div>
          </dl>

          @if (allRows().length === 0) {
            <z-empty
              zIcon="lucideWallet"
              zDescription="Nenhum movimento financeiro neste mês."
              class="admin-pane bg-card rounded-2xl border border-border py-10"
            />
          } @else {
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="inline-flex items-center gap-1.5" role="group" aria-label="Filtrar situação">
                <button
                  z-button
                  [zType]="effectiveFilter() === 'pending' ? 'default' : 'outline'"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-xl"
                  (click)="filter.set('pending')"
                >
                  Com pendência ({{ pendingRowsCount() }})
                </button>
                <button
                  z-button
                  [zType]="effectiveFilter() === 'all' ? 'default' : 'outline'"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-xl"
                  (click)="filter.set('all')"
                >
                  Todos ({{ allRows().length }})
                </button>
                <button
                  z-button
                  [zType]="effectiveFilter() === 'paid' ? 'default' : 'outline'"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-xl"
                  (click)="filter.set('paid')"
                >
                  Pagos ({{ paidRowsCount() }})
                </button>
              </div>
            </div>

            @if (visibleRows().length === 0) {
              <z-card class="rounded-2xl p-6 text-center text-sm text-muted-foreground shadow-2xs">
                Nenhum paciente neste filtro.
              </z-card>
            } @else {
              <ul class="space-y-3">
                @for (row of visibleRows(); track row.line.patientId) {
                  <li>
                    <z-card class="rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-base font-semibold text-foreground">{{ row.name }}</h2>
                            <z-badge [zType]="statusBadgeType(row.status)" [class]="statusBadgeClass(row.status)">
                              {{ row.statusLabel }}
                            </z-badge>
                            @if (row.chargedAt; as chargedAt) {
                              <span class="text-xs text-muted-foreground">
                                Cobrada em {{ shortDate(chargedAt) }}
                              </span>
                            }
                          </div>

                          <p class="text-sm font-medium text-foreground tabular-nums">{{ row.headline }}</p>
                          <p class="text-xs text-muted-foreground tabular-nums">{{ row.subline }}</p>

                          @if (row.invalidPhone) {
                            <p class="text-xs text-amber-800 pt-0.5">
                              Telefone inválido para WhatsApp.
                              <a routerLink="/admin/pacientes" class="text-primary underline underline-offset-4 font-medium">
                                Corrigir em Pacientes
                              </a>
                            </p>
                          }
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                          @if (row.pixPrefill; as prefill) {
                            <button
                              z-button
                              zType="default"
                              zSize="sm"
                              type="button"
                              class="min-h-10 rounded-xl px-3.5"
                              (click)="openPixForm(prefill)"
                            >
                              Registrar Pix
                            </button>
                          }

                          @if (row.chargeUrl; as url) {
                            <a
                              z-button
                              zType="outline"
                              zSize="sm"
                              class="min-h-10 rounded-xl px-3.5 border-[#4D6D66]/35 hover:border-[#4D6D66]/65"
                              [href]="url"
                              target="_blank"
                              rel="noopener noreferrer"
                              (click)="onChargeOpened(row.line.patientId)"
                            >
                              Cobrar no WhatsApp
                              <ng-icon name="lucideExternalLink" class="size-3.5" />
                            </a>
                          }

                          <button
                            z-button
                            zType="ghost"
                            zSize="sm"
                            type="button"
                            class="min-h-10 rounded-xl px-3 text-muted-foreground"
                            [attr.aria-expanded]="isExpanded(row.line.patientId)"
                            (click)="toggleDetails(row.line.patientId)"
                          >
                            Ver cálculo
                            <ng-icon
                              name="lucideChevronDown"
                              class="size-3.5 transition-transform"
                              [class.rotate-180]="isExpanded(row.line.patientId)"
                            />
                          </button>
                        </div>
                      </div>

                      @if (awaitingChargeId() === row.line.patientId) {
                        <div
                          class="rounded-xl border border-[#4D6D66]/25 bg-[#D4E6E1]/45 p-4 space-y-3"
                          role="group"
                          aria-label="Confirmar envio da cobrança"
                        >
                          <p class="text-sm font-medium text-foreground">Enviou a mensagem?</p>
                          <div class="flex flex-wrap items-center gap-2">
                            <button
                              z-button
                              type="button"
                              class="min-h-11 rounded-xl px-4"
                              [zLoading]="savingCharge()"
                              [zDisabled]="savingCharge()"
                              (click)="confirmCharged(row)"
                            >
                              Sim, marcar como cobrada
                            </button>
                            <button
                              z-button
                              zType="outline"
                              type="button"
                              class="min-h-11 rounded-xl px-4"
                              [zDisabled]="savingCharge()"
                              (click)="awaitingChargeId.set(null)"
                            >
                              Ainda não
                            </button>
                          </div>
                          @if (chargeError(); as message) {
                            <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
                          }
                        </div>
                      }

                      @if (isExpanded(row.line.patientId)) {
                        <div class="rounded-xl bg-[#FDFBF7] border border-border/70 p-4 text-sm space-y-2 tabular-nums">
                          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                            <div class="flex items-center justify-between gap-2">
                              <dt class="text-muted-foreground">Sessões do mês (devido)</dt>
                              <dd class="font-medium text-foreground">
                                {{ summary().hasLinkedSessions ? formatCents(row.line.due) : '—' }}
                              </dd>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                              <dt class="text-muted-foreground">Pix recebidos no mês</dt>
                              <dd class="font-medium text-primary">{{ formatCents(row.line.received) }}</dd>
                            </div>
                            @if (row.line.abated > 0) {
                              <div class="flex items-center justify-between gap-2">
                                <dt class="text-muted-foreground">Crédito de outros meses usado</dt>
                                <dd class="font-medium text-foreground">{{ formatCents(row.line.abated) }}</dd>
                              </div>
                            }
                            @if (summary().hasLinkedSessions && row.line.toReceive > 0) {
                              <div class="flex items-center justify-between gap-2">
                                <dt class="text-muted-foreground">Falta pagar deste mês</dt>
                                <dd class="font-medium text-foreground">{{ formatCents(row.line.toReceive) }}</dd>
                              </div>
                            }
                            @if (summary().hasLinkedSessions && row.line.overdue > 0) {
                              <div class="flex items-center justify-between gap-2">
                                <dt class="text-muted-foreground">Atraso de meses anteriores</dt>
                                <dd class="font-medium text-destructive">{{ formatCents(row.line.overdue) }}</dd>
                              </div>
                            }
                            @if (summary().hasLinkedSessions && row.line.credit > 0) {
                              <div class="flex items-center justify-between gap-2">
                                <dt class="text-muted-foreground">Crédito guardado para o próximo mês</dt>
                                <dd class="font-medium text-primary">{{ formatCents(row.line.credit) }}</dd>
                              </div>
                            }
                          </dl>

                          @if (row.line.sources.length > 0) {
                            <ul class="pt-2 border-t border-border/60 text-xs text-muted-foreground space-y-1">
                              @for (source of row.line.sources; track source.fromMonth) {
                                <li>
                                  • {{ formatCents(source.amount) }} abatidos com crédito de {{ monthLabel(source.fromMonth) }}
                                </li>
                              }
                            </ul>
                          }
                        </div>
                      }
                    </z-card>
                  </li>
                }
              </ul>
            }
          }
        }
      }
    </section>
  `,
})
export class FinanceHubComponent {
  private readonly adminMonth = inject(AdminMonthService);
  private readonly sessionsService = inject(SessionsService);
  protected readonly patientsService = inject(PatientsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly chargesService = inject(ChargesService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly formHost = viewChild<ElementRef<HTMLElement>>('formHost');

  private readonly allSessions = this.sessionsService.watchAll();
  private scrollFrame = 0;

  protected readonly formatCents = formatCents;
  protected readonly shortDate = shortDateOf;
  protected readonly monthLabel = monthLabel;
  protected readonly unlinkedNote = unlinkedNote;
  protected readonly month = this.adminMonth.month;

  readonly activeTab = signal<FinanceTab>(parseTab(this.route?.snapshot?.queryParamMap?.get('aba')));
  readonly filter = signal<FinanceFilter | null>(null);
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  readonly pixFormOpen = signal(false);
  readonly pixPrefill = signal<PixPrefill | null>(null);
  readonly pixError = signal<string | null>(null);
  readonly awaitingChargeId = signal<string | null>(null);
  readonly savingCharge = signal(false);
  readonly chargeError = signal<string | null>(null);
  protected readonly reportPixFailure = (message: string) => this.pixError.set(message);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelScroll());

    const params = this.route?.snapshot?.queryParamMap;
    const queryMes = params?.get('mes');
    if (queryMes && isValidMonth(queryMes)) {
      this.adminMonth.setMonth(queryMes);
    }

    if (params) {
      const prefill = parsePixPrefill(params);
      if (prefill) {
        this.pixPrefill.set(prefill);
        this.pixFormOpen.set(true);
      }
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

  private readonly patientsById = computed(
    () => new Map(this.patientsService.patients().map(p => [p.id, p] as const)),
  );

  protected readonly allRows = computed(() =>
    buildFinanceRows({
      summary: this.summary(),
      patients: this.patientsById(),
      charges: this.chargesService.watchMonth(this.month()).charges(),
    }),
  );

  protected readonly pendingRowsCount = computed(
    () => this.allRows().filter(r => r.status === 'overdue' || r.status === 'open' || r.status === 'pending_sync').length,
  );
  protected readonly paidRowsCount = computed(
    () => this.allRows().filter(r => r.status === 'paid' || r.status === 'credit').length,
  );

  protected readonly effectiveFilter = computed<FinanceFilter>(() => {
    const manual = this.filter();
    if (manual !== null) return manual;
    return this.pendingRowsCount() > 0 ? 'pending' : 'all';
  });

  protected readonly visibleRows = computed(() => {
    const active = this.effectiveFilter();
    if (active === 'all') return this.allRows();
    if (active === 'pending') {
      return this.allRows().filter(r => r.status === 'overdue' || r.status === 'open' || r.status === 'pending_sync');
    }
    return this.allRows().filter(r => r.status === 'paid' || r.status === 'credit');
  });

  protected readonly chargeableCount = computed(() => {
    const queue = buildChargeQueue({
      lines: this.summary().lines,
      patients: this.patientsById(),
      charges: this.chargesService.watchMonth(this.month()).charges(),
      hasLinkedSessions: this.summary().hasLinkedSessions,
      now: new Date(),
    });
    return queue.items.filter(item => !item.recentlyCharged).length;
  });

  protected readonly toReceiveCents = computed(() =>
    this.summary().hasLinkedSessions ? this.summary().toReceive : null,
  );
  protected readonly overdueCents = computed(() =>
    this.summary().hasLinkedSessions ? this.summary().overdue : null,
  );

  setTab(tab: FinanceTab): void {
    this.activeTab.set(tab);
  }

  openPixForm(prefill: PixPrefill | null): void {
    this.pixError.set(null);
    this.pixPrefill.set(prefill);
    this.pixFormOpen.set(true);
    this.scrollFormIntoView();
  }

  onPixSaved(): void {
    this.pixError.set(null);
    this.closePixForm();
  }

  closePixForm(): void {
    this.pixFormOpen.set(false);
    this.pixPrefill.set(null);
  }

  onChargeOpened(patientId: string): void {
    this.chargeError.set(null);
    this.awaitingChargeId.set(patientId);
  }

  /** Só marca depois da confirmação, para não registrar cobrança aberta e não enviada. */
  async confirmCharged(row: FinanceDisplayRow): Promise<void> {
    if (this.savingCharge()) return;
    this.savingCharge.set(true);
    this.chargeError.set(null);
    try {
      await this.chargesService.markCharged(
        row.line.patientId,
        this.month(),
        row.line.toReceive + row.line.overdue,
      );
      this.awaitingChargeId.set(null);
    } catch (err) {
      this.chargeError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.savingCharge.set(false);
    }
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

  protected statusBadgeType(status: FinanceRowStatus): ZardBadgeTypeVariants {
    return status === 'pending_sync' ? 'outline' : 'secondary';
  }

  protected statusBadgeClass(status: FinanceRowStatus): string {
    if (status === 'overdue') return 'bg-red-100 text-red-800';
    if (status === 'open') return 'bg-amber-100 text-amber-900';
    if (status === 'credit') return 'bg-[#D4E6E1] text-[#1C221F]';
    if (status === 'paid') return 'bg-[#D4E6E1]/70 text-[#1C221F]';
    return 'bg-stone-100 text-stone-700';
  }

  private scrollFormIntoView(): void {
    this.cancelScroll();
    if (typeof requestAnimationFrame !== 'function') return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      const el = this.formHost()?.nativeElement;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'nearest',
        });
      }
    });
  }

  private cancelScroll(): void {
    if (this.scrollFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.scrollFrame);
    }
    this.scrollFrame = 0;
  }
}
