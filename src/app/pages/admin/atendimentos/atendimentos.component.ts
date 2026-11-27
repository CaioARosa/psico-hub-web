import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendar,
  lucideCheck,
  lucideCheckCircle2,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent, type ZardBadgeTypeVariants } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardSelectImports } from '@/shared/components/select';
import { ZardSeparatorComponent } from '@/shared/components/separator';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { AdminMonthService } from '../data/admin-month.service';
import { AutoSyncService } from '../data/auto-sync.service';
import { PatientsService } from '../data/patients.service';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import {
  groupByDay,
  monthsInWindow,
  shiftWeek,
  weekLabel,
  weekWindow,
  type WeekWindow,
} from '../domain/agenda';
import { timeOf } from '../domain/datetime';
import type { ConfirmableStatus, Session, SessionStatus } from '../domain/models';
import { currentMonth, isValidMonth, monthLabel, shiftMonth } from '../domain/month';
import {
  canConfirm,
  formatSessionDateTime,
  groupSessions,
  rescheduleNote,
  statusLabel,
} from '../domain/sessions-view';
import { SessionActionsComponent } from '../sessions/session-actions.component';

export type AtendimentosTab = 'semana' | 'pendencias' | 'mes';

function parseTab(raw: string | null | undefined): AtendimentosTab {
  if (raw === 'pendencias' || raw === 'mes') return raw;
  return 'semana';
}

@Component({
  selector: 'app-admin-atendimentos',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    NgIcon,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardEmptyComponent,
    ZardSeparatorComponent,
    ZardSkeletonComponent,
    SessionActionsComponent,
    ...ZardCardImports,
    ...ZardSelectImports,
  ],
  viewProviders: [
    provideIcons({
      lucideCalendar,
      lucideCheck,
      lucideCheckCircle2,
      lucideChevronDown,
      lucideChevronLeft,
      lucideChevronRight,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Atendimentos</h1>
          <p class="text-sm text-muted-foreground mt-0.5">
            Acompanhe a semana, resolva pendências e confirme presenças.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Visualização de atendimentos"
          class="inline-flex items-center rounded-xl border border-border bg-card p-1 gap-1"
        >
          <button
            role="tab"
            type="button"
            [attr.aria-selected]="activeTab() === 'semana'"
            (click)="setTab('semana')"
            class="min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors"
            [class.bg-[#4D6D66]]="activeTab() === 'semana'"
            [class.text-white]="activeTab() === 'semana'"
            [class.text-muted-foreground]="activeTab() !== 'semana'"
            [class.hover:text-foreground]="activeTab() !== 'semana'"
          >
            Semana
          </button>

          <button
            role="tab"
            type="button"
            [attr.aria-selected]="activeTab() === 'pendencias'"
            (click)="setTab('pendencias')"
            class="inline-flex items-center gap-1.5 min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors"
            [class.bg-[#4D6D66]]="activeTab() === 'pendencias'"
            [class.text-white]="activeTab() === 'pendencias'"
            [class.text-muted-foreground]="activeTab() !== 'pendencias'"
            [class.hover:text-foreground]="activeTab() !== 'pendencias'"
          >
            <span>Pendências</span>
            @if (totalPendingCount() > 0) {
              <span
                class="inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
                [class.bg-white/20]="activeTab() === 'pendencias'"
                [class.text-white]="activeTab() === 'pendencias'"
                [class.bg-amber-100]="activeTab() !== 'pendencias'"
                [class.text-amber-900]="activeTab() !== 'pendencias'"
              >
                {{ totalPendingCount() }}
              </span>
            }
          </button>

          <button
            role="tab"
            type="button"
            [attr.aria-selected]="activeTab() === 'mes'"
            (click)="setTab('mes')"
            class="min-h-10 rounded-lg px-3.5 text-sm font-medium transition-colors"
            [class.bg-[#4D6D66]]="activeTab() === 'mes'"
            [class.text-white]="activeTab() === 'mes'"
            [class.text-muted-foreground]="activeTab() !== 'mes'"
            [class.hover:text-foreground]="activeTab() !== 'mes'"
          >
            Mês ({{ monthSessions().length }})
          </button>
        </div>
      </header>

      @if (actionMessage()) {
        <z-alert
          zRole="status"
          zIcon="lucideCheck"
          class="bg-[#D4E6E1]/45 border-[#4D6D66]/25 text-foreground rounded-xl"
          [zDescription]="actionMessage()!"
        />
      }

      @if (actionError()) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="actionError()!" />
      }

      @if (watch.error()) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="watch.error()!" />
      } @else if (!watch.loaded()) {
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">Carregando atendimentos…</p>
          @for (i of [1, 2, 3]; track i) {
            <z-skeleton class="h-24 w-full rounded-2xl" />
          }
        </div>
      } @else {
        @if (activeTab() === 'semana') {
          <div class="space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm font-medium text-muted-foreground tabular-nums">{{ weekTitle() }}</p>
              <div class="inline-flex items-center rounded-xl border border-border bg-card p-1 gap-1">
                <button
                  z-button
                  zType="ghost"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-lg px-3"
                  (click)="shiftWeekBy(-1)"
                >
                  <ng-icon name="lucideChevronLeft" class="size-4" />
                  Semana
                </button>
                <button
                  z-button
                  zType="ghost"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-lg px-3"
                  (click)="goToToday()"
                >
                  Hoje
                </button>
                <button
                  z-button
                  zType="ghost"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-lg px-3"
                  (click)="shiftWeekBy(1)"
                >
                  Semana
                  <ng-icon name="lucideChevronRight" class="size-4" />
                </button>
              </div>
            </div>

            @if (days().length === 0) {
              <z-empty
                zIcon="lucideCalendar"
                zDescription="Nenhuma sessão nesta semana."
                class="admin-pane bg-card rounded-2xl border border-border py-10"
              />
            } @else {
              <div class="space-y-5">
                @for (day of days(); track day.dayKey) {
                  <section class="space-y-2">
                    <h2
                      class="text-xs font-semibold uppercase tracking-wider px-1"
                      [class.text-primary]="day.isToday"
                      [class.text-muted-foreground]="!day.isToday"
                    >
                      {{ day.label }}
                    </h2>

                    <z-card class="rounded-2xl divide-y divide-border/70 overflow-hidden shadow-2xs p-0">
                      @for (session of day.sessions; track session.id) {
                        <div
                          class="p-4 space-y-3"
                          [attr.data-session-id]="session.id"
                          [class.opacity-65]="session.status === 'rescheduled'"
                        >
                          <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex flex-wrap items-baseline gap-3 min-w-0">
                              <span class="font-mono text-sm font-semibold text-foreground tabular-nums">
                                {{ formatTime(session.startsAt) }}
                              </span>
                              <div class="min-w-0">
                                <span class="font-medium text-foreground">{{ patientName(session) }}</span>
                                @if (noteOf(session); as note) {
                                  <p class="text-xs text-slate-600 mt-0.5">{{ note }}</p>
                                }
                                @if (session.patientId === null && session.calendarTitle) {
                                  <p class="text-xs text-muted-foreground mt-0.5">{{ session.calendarTitle }}</p>
                                }
                              </div>
                            </div>

                            <div class="flex flex-wrap items-center gap-2">
                              <z-badge [zType]="badgeType(session.status)" [class]="badgeExtraClass(session.status)">
                                {{ statusText(session.status) }}
                              </z-badge>

                              @if (session.patientId !== null) {
                                <button
                                  z-button
                                  [zType]="needsConfirmation(session) ? 'default' : 'outline'"
                                  zSize="sm"
                                  type="button"
                                  class="min-h-10 rounded-xl px-3"
                                  [attr.aria-expanded]="expandedId() === session.id"
                                  (click)="toggleExpanded(session.id)"
                                >
                                  {{ needsConfirmation(session) ? 'Confirmar' : 'Ações' }}
                                  <ng-icon
                                    name="lucideChevronDown"
                                    class="size-3.5 transition-transform"
                                    [class.rotate-180]="expandedId() === session.id"
                                  />
                                </button>
                              }
                            </div>
                          </div>

                          @if (session.patientId === null) {
                            <ng-container
                              [ngTemplateOutlet]="linkPatientBlock"
                              [ngTemplateOutletContext]="{ $implicit: session }"
                            />
                          } @else if (expandedId() === session.id) {
                            <div class="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                              <app-session-actions
                                [session]="session"
                                [patients]="patientsService.patients()"
                                [locked]="busyId() !== null"
                                (workingChange)="onActionBusy(session.id, $event)"
                                (done)="onActionDone($event)"
                                (failed)="actionError.set($event)"
                              />
                            </div>
                          }
                        </div>
                      }
                    </z-card>
                  </section>
                }
              </div>
            }
          </div>
        } @else if (activeTab() === 'pendencias') {
          <div class="space-y-6">
            @if (totalPendingCount() === 0) {
              <div
                role="status"
                class="flex items-center gap-3 rounded-2xl border border-[#4D6D66]/25 bg-[#D4E6E1]/45 px-5 py-6"
              >
                <ng-icon name="lucideCheckCircle2" class="size-5 text-primary shrink-0" />
                <div>
                  <p class="text-sm font-semibold text-foreground">Nenhuma pendência de atendimento</p>
                  <p class="text-xs text-muted-foreground">
                    Todas as sessões passadas estão vinculadas e confirmadas.
                  </p>
                </div>
              </div>
            } @else {
              @if (currentGroups().unidentified.length > 0) {
                <section class="space-y-3">
                  <h2 class="text-sm font-semibold text-foreground">
                    Sem paciente identificado ({{ currentGroups().unidentified.length }})
                  </h2>
                  <ul class="space-y-3">
                    @for (session of currentGroups().unidentified; track session.id) {
                      <li>
                        <ng-container
                          [ngTemplateOutlet]="sessionCard"
                          [ngTemplateOutletContext]="{ $implicit: session }"
                        />
                      </li>
                    }
                  </ul>
                </section>
              }

              @if (currentGroups().pending.length > 0) {
                <section class="space-y-3">
                  <h2 class="text-sm font-semibold text-foreground">
                    Aguardando confirmação ({{ currentGroups().pending.length }})
                  </h2>
                  <ul class="space-y-3">
                    @for (session of currentGroups().pending; track session.id) {
                      <li>
                        <ng-container
                          [ngTemplateOutlet]="sessionCard"
                          [ngTemplateOutletContext]="{ $implicit: session }"
                        />
                      </li>
                    }
                  </ul>
                </section>
              }

              @if (previousMonthPending().length > 0) {
                <section class="space-y-3 pt-2">
                  <div class="space-y-0.5">
                    <h2 class="text-sm font-semibold text-foreground">
                      Restantes de {{ previousMonthLabel() }} ({{ previousMonthPending().length }})
                    </h2>
                    <p class="text-xs text-muted-foreground">
                      Sessões do mês anterior ainda em aberto — resolva direto aqui sem precisar trocar o mês.
                    </p>
                  </div>
                  <ul class="space-y-3">
                    @for (session of previousMonthPending(); track session.id) {
                      <li>
                        <ng-container
                          [ngTemplateOutlet]="sessionCard"
                          [ngTemplateOutletContext]="{ $implicit: session }"
                        />
                      </li>
                    }
                  </ul>
                </section>
              }
            }
          </div>
        } @else {
          <div class="space-y-4">
            @if (monthSessions().length === 0) {
              <z-empty
                zIcon="lucideCalendar"
                zDescription="Nenhuma sessão encontrada neste mês."
                class="admin-pane bg-card rounded-2xl border border-border py-10"
              />
            } @else {
              <ul class="space-y-3">
                @for (session of monthSessions(); track session.id) {
                  <li>
                    <ng-container
                      [ngTemplateOutlet]="sessionCard"
                      [ngTemplateOutletContext]="{ $implicit: session }"
                    />
                  </li>
                }
              </ul>
            }
          </div>
        }
      }

      <ng-template #sessionCard let-session>
        <z-card class="rounded-2xl p-4 space-y-3 shadow-2xs" [class.admin-busy]="busyId() === session.id">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-foreground">{{ patientName(session) }}</span>
                <z-badge [zType]="badgeType(session.status)" [class]="badgeExtraClass(session.status)">
                  {{ statusText(session.status) }}
                </z-badge>
                @if (session.missingFromCalendar) {
                  <z-badge zType="secondary" class="bg-amber-100 text-amber-800">
                    Removida do Agenda
                  </z-badge>
                }
              </div>
              <p class="text-sm text-muted-foreground tabular-nums">{{ formatDateTime(session.startsAt) }}</p>
              @if (noteOf(session); as note) {
                <p class="text-xs text-slate-600">{{ note }}</p>
              }
              @if (session.calendarTitle) {
                <p class="text-xs text-muted-foreground">{{ session.calendarTitle }}</p>
              }
            </div>

            @if (canConfirmSession(session)) {
              <app-session-actions
                [session]="session"
                [patients]="patientsService.patients()"
                [locked]="busyId() !== null"
                (workingChange)="onActionBusy(session.id, $event)"
                (done)="onActionDone($event)"
                (failed)="actionError.set($event)"
              />
            }
          </div>

          @if (!canConfirmSession(session)) {
            <ng-container
              [ngTemplateOutlet]="linkPatientBlock"
              [ngTemplateOutletContext]="{ $implicit: session }"
            />
          }

          @if (session.missingFromCalendar) {
            <z-separator />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">Este evento não está mais no Google Agenda.</span>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  z-button
                  zType="outline"
                  zSize="sm"
                  type="button"
                  class="min-h-10 rounded-xl"
                  [zDisabled]="busyId() === session.id"
                  (click)="keepSession(session)"
                >
                  Manter
                </button>
                @if (canConfirmSession(session)) {
                  <button
                    z-button
                    zType="destructive"
                    zSize="sm"
                    type="button"
                    class="min-h-10 rounded-xl"
                    [zDisabled]="busyId() === session.id"
                    (click)="changeStatus(session, 'cancelled')"
                  >
                    Cancelar sessão
                  </button>
                } @else {
                  <button
                    z-button
                    zType="destructive"
                    zSize="sm"
                    type="button"
                    class="min-h-10 rounded-xl"
                    [zDisabled]="busyId() === session.id"
                    (click)="removeUnlinkedSession(session)"
                  >
                    Remover
                  </button>
                }
              </div>
            </div>
          }
        </z-card>
      </ng-template>

      <ng-template #linkPatientBlock let-session>
        <div class="pt-3 border-t border-border/60 flex flex-wrap items-end gap-2">
          <div class="space-y-1 grow max-w-xs">
            <label [attr.for]="'link-patient-' + session.id" class="block text-xs font-medium text-foreground">
              Vincular paciente ativo
            </label>
            <z-select
              [id]="'link-patient-' + session.id"
              [zLabel]="'Vincular paciente ativo'"
              zPlaceholder="Selecione um paciente..."
              class="w-full"
              [zValue]="selectedPatients()[session.id] ?? ''"
              (zSelectionChange)="selectPatient(session.id, $any($event))"
            >
              @for (patient of activePatients(); track patient.id) {
                <z-select-item [zValue]="patient.id">{{ patient.name }}</z-select-item>
              }
            </z-select>
          </div>
          <button
            z-button
            zSize="sm"
            type="button"
            class="min-h-10 rounded-xl px-4"
            [zLoading]="busyId() === session.id"
            [zDisabled]="!selectedPatients()[session.id] || busyId() === session.id"
            (click)="linkSelectedPatient(session)"
          >
            Vincular
          </button>
          <p class="w-full text-xs text-muted-foreground">
            O título no Google Agenda não casou com nenhum cadastro. Vincule para confirmar e calcular o valor.
          </p>
        </div>
      </ng-template>
    </section>
  `,
})
export class AtendimentosComponent {
  protected readonly sessionsService = inject(SessionsService);
  protected readonly patientsService = inject(PatientsService);
  private readonly adminMonth = inject(AdminMonthService);
  private readonly autoSync = inject(AutoSyncService);
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly watch = this.sessionsService.watchAll();
  readonly now = signal(new Date());
  readonly window = signal<WeekWindow>(weekWindow(this.now()));
  readonly activeTab = signal<AtendimentosTab>(
    parseTab(this.route?.snapshot?.queryParamMap?.get('aba')),
  );
  readonly expandedId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly selectedPatients = signal<Record<string, string | undefined>>({});

  constructor() {
    const queryMes = this.route?.snapshot?.queryParamMap?.get('mes');
    if (queryMes && isValidMonth(queryMes)) {
      this.adminMonth.setMonth(queryMes);
    }
  }

  protected readonly weekTitle = computed(() => weekLabel(this.window()));
  protected readonly days = computed(() => groupByDay(this.watch.sessions(), this.window(), this.now()));

  protected readonly monthSessions = computed(() => {
    const target = this.adminMonth.month();
    return this.watch
      .sessions()
      .filter(s => currentMonth(s.startsAt) === target)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  });

  protected readonly currentGroups = computed(() => groupSessions(this.monthSessions(), this.now()));

  private readonly previousMonth = computed(() => shiftMonth(this.adminMonth.month(), -1));
  protected readonly previousMonthLabel = computed(() => monthLabel(this.previousMonth()));
  protected readonly previousMonthPending = computed(() => {
    const prev = this.previousMonth();
    const prevSessions = this.watch.sessions().filter(s => currentMonth(s.startsAt) === prev);
    const groups = groupSessions(prevSessions, this.now());
    return [...groups.unidentified, ...groups.pending];
  });

  protected readonly totalPendingCount = computed(
    () =>
      this.currentGroups().unidentified.length +
      this.currentGroups().pending.length +
      this.previousMonthPending().length,
  );

  protected readonly activePatients = computed(() =>
    this.patientsService.patients().filter(p => p.active),
  );
  private readonly patientNames = computed(
    () => new Map(this.patientsService.patients().map(p => [p.id, p.name] as const)),
  );

  setTab(tab: AtendimentosTab): void {
    this.activeTab.set(tab);
    this.actionMessage.set(null);
    this.actionError.set(null);
  }

  shiftWeekBy(delta: number): void {
    const nextStart = shiftWeek(this.window().start, delta);
    this.window.set(weekWindow(nextStart));
    this.expandedId.set(null);
    this.actionMessage.set(null);
    this.actionError.set(null);
    void this.autoSync.run(monthsInWindow(this.window()));
  }

  goToToday(): void {
    this.goToDate(new Date());
    void this.autoSync.run(monthsInWindow(this.window()));
  }

  goToDate(date: Date): void {
    this.now.set(date);
    this.window.set(weekWindow(date));
    this.expandedId.set(null);
    this.actionMessage.set(null);
    this.actionError.set(null);
  }

  toggleExpanded(sessionId: string): void {
    this.expandedId.update(current => (current === sessionId ? null : sessionId));
  }

  selectPatient(sessionId: string, patientId: string): void {
    this.selectedPatients.update(current => ({ ...current, [sessionId]: patientId }));
  }

  protected needsConfirmation(session: Session): boolean {
    return session.status === 'scheduled' && session.patientId !== null && session.startsAt < this.now();
  }

  protected patientName(session: Session): string {
    if (session.patientId === null) return 'Paciente não identificado';
    return this.patientNames().get(session.patientId) ?? 'Paciente não identificado';
  }

  protected canConfirmSession(session: Session): boolean {
    return canConfirm(session);
  }

  protected statusText(status: SessionStatus): string {
    return statusLabel(status);
  }

  protected formatTime(date: Date): string {
    return timeOf(date);
  }

  protected formatDateTime(date: Date): string {
    return formatSessionDateTime(date);
  }

  protected noteOf(session: Session): string | null {
    return rescheduleNote(session);
  }

  protected badgeType(status: SessionStatus): ZardBadgeTypeVariants {
    return status === 'cancelled' ? 'outline' : 'secondary';
  }

  protected badgeExtraClass(status: SessionStatus): string {
    if (status === 'done') return 'bg-[#D4E6E1] text-[#1C221F]';
    if (status === 'no_show') return 'bg-amber-100 text-amber-800';
    if (status === 'cancelled') return 'bg-stone-100 text-stone-700';
    if (status === 'rescheduled') return 'bg-slate-100 text-slate-700';
    return 'bg-[#4C645B]/10 text-[#556661]';
  }

  protected onActionBusy(id: string, busy: boolean): void {
    if (busy) {
      this.actionMessage.set(null);
      this.actionError.set(null);
      this.busyId.set(id);
    } else if (this.busyId() === id) {
      this.busyId.set(null);
    }
  }

  protected onActionDone(message: string | null): void {
    if (message) this.actionMessage.set(message);
  }

  async linkSelectedPatient(session: Session): Promise<void> {
    if (this.busyId() !== null) return;
    const patientId = this.selectedPatients()[session.id];
    const patient = this.activePatients().find(p => p.id === patientId);
    if (!patient) return;
    await this.runAction(session.id, () => this.sessionsService.linkPatient(session.id, patient));
  }

  async changeStatus(session: Session, status: ConfirmableStatus): Promise<void> {
    if (!canConfirm(session)) {
      this.actionError.set('Vincule um paciente a esta sessão antes de confirmá-la.');
      return;
    }
    await this.runAction(session.id, () => this.sessionsService.setStatus(session.id, status));
  }

  async keepSession(session: Session): Promise<void> {
    await this.runAction(session.id, () => this.sessionsService.clearMissing(session.id));
  }

  async removeUnlinkedSession(session: Session): Promise<void> {
    await this.runAction(session.id, () => this.sessionsService.removeUnlinked(session.id));
  }

  private async runAction(id: string, action: () => Promise<void>): Promise<void> {
    if (this.busyId() !== null) return;
    this.actionError.set(null);
    this.busyId.set(id);
    try {
      await action();
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.busyId.set(null);
    }
  }
}
