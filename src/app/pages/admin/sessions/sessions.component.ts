import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideCheck, lucideRefreshCw, lucideX } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent, type ZardBadgeTypeVariants } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardSelectImports } from '@/shared/components/select';
import { ZardSeparatorComponent } from '@/shared/components/separator';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { ZardTabGroupComponent, ZardTabsImports } from '@/shared/components/tabs';
import { AutoSyncService } from '../data/auto-sync.service';
import { PatientsService } from '../data/patients.service';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import type { ConfirmableStatus, Session, SessionStatus } from '../domain/models';
import { currentMonth, isValidMonth } from '../domain/month';
import {
  canConfirm,
  formatSessionDateTime,
  groupSessions,
  rescheduleNote,
  statusLabel,
} from '../domain/sessions-view';
import { syncSummary } from '../domain/sync-summary';
import { MonthPickerComponent } from '../month-picker.component';
import { canAnimateMotion } from '../motion/reduced-motion';
import { SessionActionsComponent } from './session-actions.component';

export type SessionTab = 'all' | 'pending' | 'unidentified';
const TAB_ORDER: readonly SessionTab[] = ['all', 'pending', 'unidentified'];
const QUERY_TAB_MAP: Readonly<Record<string, SessionTab>> = {
  todas: 'all',
  pendentes: 'pending',
  'nao-identificados': 'unidentified',
};

function parseQueryTab(raw: string | null | undefined): SessionTab | null {
  if (!raw) return null;
  return QUERY_TAB_MAP[raw] ?? null;
}

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    NgIcon,
    ZardButtonComponent,
    ZardBadgeComponent,
    ZardAlertComponent,
    MonthPickerComponent,
    SessionActionsComponent,
    ...ZardSelectImports,
    ZardSkeletonComponent,
    ZardEmptyComponent,
    ZardSeparatorComponent,
    ...ZardCardImports,
    ...ZardTabsImports,
  ],
  viewProviders: [provideIcons({ lucideCalendar, lucideCheck, lucideRefreshCw, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .admin-session-card { position: relative; overflow: hidden; }
      .admin-session-card::before {
        content: '';
        position: absolute;
        inset-block: 0;
        left: 0;
        width: 3px;
        background-color: rgb(76 100 91 / 0.18);
        transition: background-color 0.28s var(--admin-ease);
      }
      .admin-session-card[data-status='done']::before { background-color: #4d6d66; }
      .admin-session-card[data-status='no_show']::before { background-color: #d97706; }
      .admin-session-card[data-status='cancelled']::before { background-color: #a8a29e; }
      .admin-session-card[data-status='rescheduled']::before { background-color: #64748b; }
      .admin-badge-smooth { transition: background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease; }
      @keyframes session-flash {
        0% { box-shadow: 0 0 0 0 rgb(77 109 102 / 0.28); border-color: rgb(77 109 102 / 0.55); }
        100% { box-shadow: 0 0 0 8px rgb(77 109 102 / 0); }
      }
      .admin-flash { animation: session-flash 0.75s var(--admin-ease); }
      .admin-spin-hover ng-icon { display: inline-flex; transition: transform 0.28s var(--admin-spring); }
      @media (hover: hover) {
        .admin-spin-hover:hover:not(:disabled) ng-icon { transform: rotate(45deg); }
      }
    `,
  ],
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Sessões</h1>
          <p class="text-xs text-muted-foreground mt-0.5">Sincronize com o Google Agenda e confirme as presenças.</p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <div class="space-y-1.5">
            <label for="session-month" class="block text-sm font-medium text-foreground">Mês</label>
            <app-month-picker zId="session-month" [month]="month()" (monthChange)="setMonth($event)" />
          </div>

          <button
            z-button
            type="button"
            class="admin-spin-hover h-11 rounded-xl px-4"
            [zLoading]="syncing()"
            [zDisabled]="syncing()"
            (click)="syncCalendar()"
          >
            @if (!syncing()) {
              <ng-icon name="lucideRefreshCw" class="size-4" />
            }
            {{ syncing() ? 'Sincronizando...' : 'Sincronizar agenda' }}
          </button>
        </div>
      </header>

      @if (syncMessage()) {
        <div class="relative">
          <z-alert
            zRole="status"
            zIcon="lucideCheck"
            class="bg-[#D4E6E1]/45 border-[#4D6D66]/25 text-foreground rounded-xl pr-10"
            [zDescription]="syncMessage()!"
          />
          <button
            type="button"
            aria-label="Fechar aviso"
            (click)="syncMessage.set(null)"
            class="absolute right-2.5 top-2.5 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#4D6D66]/10 transition-colors"
          >
            <ng-icon name="lucideX" class="size-3.5" />
          </button>
        </div>
      }

      @if (syncError()) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="syncError()!" />
      }

      <z-tab-group zVariant="default" (zTabChange)="onTabChange($event.index)">
        <z-tab [label]="'Todas (' + groups().all.length + ')'">
          @if (activeTab() === 'all') {
            <ng-container [ngTemplateOutlet]="sessionContent" />
          }
        </z-tab>
        <z-tab [label]="'Pendentes de confirmação (' + groups().pending.length + ')'">
          @if (activeTab() === 'pending') {
            <ng-container [ngTemplateOutlet]="sessionContent" />
          }
        </z-tab>
        <z-tab [label]="'Não identificados (' + groups().unidentified.length + ')'">
          @if (activeTab() === 'unidentified') {
            <ng-container [ngTemplateOutlet]="sessionContent" />
          }
        </z-tab>
      </z-tab-group>

      <ng-template #sessionContent>
        <div class="admin-pane space-y-4 pt-3">
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

          @if (watch().error()) {
            <z-alert zType="destructive" zRole="alert" [zDescription]="watch().error()!" />
          } @else if (!watch().loaded()) {
            <div class="space-y-3">
              <p class="text-sm text-muted-foreground">Carregando sessões...</p>
              @for (i of [1, 2, 3]; track i) {
                <z-skeleton class="h-24 w-full rounded-2xl" />
              }
            </div>
          } @else if (visibleSessions().length === 0) {
            <z-empty zIcon="lucideCalendar" [zDescription]="emptyMessage()" class="admin-pane bg-card rounded-2xl border border-border py-10" />
          } @else {
            <ul class="space-y-3 stagger-list">
              @for (session of visibleSessions(); track session.id) {
                <li>
                  <z-card
                    class="admin-lift admin-session-card rounded-2xl p-4 pl-5 space-y-3 shadow-2xs"
                    [attr.data-status]="session.status"
                    [class.admin-busy]="busyId() === session.id"
                    [class.admin-flash]="justUpdatedId() === session.id"
                  >
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

                      <app-session-actions
                        [session]="session"
                        [patients]="patientsService.patients()"
                        [locked]="busyId() !== null"
                        (workingChange)="onActionBusy(session.id, $event)"
                        (done)="onActionDone(session.id, $event)"
                        (failed)="actionError.set($event)"
                      />
                    </div>

                    @if (!canConfirmSession(session)) {
                      <z-separator />
                      <div class="flex flex-wrap items-end gap-2">
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
                          class="h-10 rounded-xl px-4"
                          [zLoading]="busyId() === session.id"
                          [zDisabled]="!selectedPatients()[session.id] || busyId() === session.id"
                          (click)="linkSelectedPatient(session)"
                        >
                          Vincular
                        </button>
                        <p [id]="'link-patient-hint-' + session.id" class="w-full text-xs text-muted-foreground">
                          O título do evento no Agenda não casou com nenhum cadastro. Vincule para liberar a confirmação e calcular o valor.
                        </p>
                      </div>
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
                </li>
              }
            </ul>
          }
        </div>
      </ng-template>
    </section>
  `,
})
export class SessionsComponent {
  protected readonly sessionsService = inject(SessionsService);
  protected readonly patientsService = inject(PatientsService);
  private readonly autoSync = inject(AutoSyncService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly tabGroup = viewChild(ZardTabGroupComponent);

  readonly month = signal(this.initialMonth());
  readonly watch = signal(this.sessionsService.watchMonth(this.month()));
  readonly activeTab = signal<SessionTab>(this.initialTab());

  readonly syncing = signal(false);
  readonly syncMessage = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);

  readonly busyId = signal<string | null>(null);
  readonly justUpdatedId = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly selectedPatients = signal<Record<string, string | undefined>>({});
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearFlashTimer());
    afterNextRender(() => {
      const idx = TAB_ORDER.indexOf(this.activeTab());
      if (idx > 0) {
        this.tabGroup()?.selectTabByIndex(idx);
      }
    });
  }

  private initialMonth(): string {
    const param = this.route?.snapshot?.queryParamMap?.get('mes') ?? null;
    return param && isValidMonth(param) ? param : currentMonth(new Date());
  }

  private initialTab(): SessionTab {
    const param = this.route?.snapshot?.queryParamMap?.get('aba') ?? null;
    return parseQueryTab(param) ?? 'all';
  }

  readonly groups = computed(() => groupSessions(this.watch().sessions(), new Date()));
  readonly visibleSessions = computed(() => this.groups()[this.activeTab()]);
  readonly activePatients = computed(() => this.patientsService.patients().filter(p => p.active));
  readonly patientNames = computed(
    () => new Map(this.patientsService.patients().map(p => [p.id, p.name])),
  );

  readonly emptyMessage = computed(() => {
    const tab = this.activeTab();
    if (tab === 'pending') return 'Nenhuma sessão pendente de confirmação.';
    if (tab === 'unidentified') return 'Nenhuma sessão sem paciente identificado.';
    return 'Nenhuma sessão neste mês. Use "Sincronizar agenda" para buscar do Google Agenda.';
  });

  setMonth(value: string): void {
    if (!isValidMonth(value) || value === this.month()) return;
    this.month.set(value);
    this.syncMessage.set(null);
    this.syncError.set(null);
    this.actionMessage.set(null);
    this.actionError.set(null);
    this.watch.set(this.sessionsService.watchMonth(value));
  }

  onTabChange(index: number): void {
    this.setTab(TAB_ORDER[index] ?? 'all');
  }

  setTab(tab: SessionTab): void {
    this.activeTab.set(tab);
    this.actionMessage.set(null);
    this.actionError.set(null);
  }

  selectPatient(sessionId: string, patientId: string): void {
    this.selectedPatients.update(current => ({ ...current, [sessionId]: patientId }));
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

  protected formatDateTime(date: Date): string {
    return formatSessionDateTime(date);
  }

  protected noteOf(session: Session): string | null {
    return rescheduleNote(session);
  }

  protected badgeType(status: SessionStatus): ZardBadgeTypeVariants {
    if (status === 'done') return 'secondary';
    if (status === 'no_show') return 'secondary';
    if (status === 'cancelled') return 'outline';
    return 'secondary';
  }

  protected badgeExtraClass(status: SessionStatus): string {
    if (status === 'done') return 'admin-badge-smooth bg-[#D4E6E1] text-[#1C221F]';
    if (status === 'no_show') return 'admin-badge-smooth bg-amber-100 text-amber-800';
    if (status === 'cancelled') return 'admin-badge-smooth bg-stone-100 text-stone-700';
    if (status === 'rescheduled') return 'admin-badge-smooth bg-slate-100 text-slate-700';
    return 'admin-badge-smooth bg-[#4C645B]/10 text-[#556661]';
  }

  protected flashSession(id: string): void {
    if (!canAnimateMotion()) return;
    this.clearFlashTimer();
    this.justUpdatedId.set(id);
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      this.justUpdatedId.set(null);
    }, 800);
  }

  private clearFlashTimer(): void {
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
  }

  async syncCalendar(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.syncError.set(null);
    this.syncMessage.set(null);
    try {
      const outcome = await this.autoSync.run([this.month()], { force: true });
      this.syncMessage.set(syncSummary(outcome.totals));
    } catch (err) {
      this.syncError.set(
        err instanceof Error ? err.message : 'Falha ao sincronizar a agenda. Tente novamente.',
      );
    } finally {
      this.syncing.set(false);
    }
  }

  async changeStatus(session: Session, status: ConfirmableStatus): Promise<void> {
    if (this.busyId() !== null) return;
    if (!canConfirm(session)) {
      this.actionError.set('Vincule um paciente a esta sessão antes de confirmá-la.');
      return;
    }
    this.actionError.set(null);
    this.busyId.set(session.id);
    try {
      await this.sessionsService.setStatus(session.id, status);
      this.flashSession(session.id);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.busyId.set(null);
    }
  }

  async linkSelectedPatient(session: Session): Promise<void> {
    if (this.busyId() !== null) return;
    const patientId = this.selectedPatients()[session.id];
    const patient = this.activePatients().find(p => p.id === patientId);
    if (!patient) return;
    this.actionError.set(null);
    this.busyId.set(session.id);
    try {
      await this.sessionsService.linkPatient(session.id, patient);
      this.flashSession(session.id);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.busyId.set(null);
    }
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

  protected onActionDone(id: string, message: string | null): void {
    this.flashSession(id);
    if (message) this.actionMessage.set(message);
  }

  async keepSession(session: Session): Promise<void> {
    await this.runSessionAction(session.id, async () => {
      await this.sessionsService.clearMissing(session.id);
      this.flashSession(session.id);
    });
  }

  async removeUnlinkedSession(session: Session): Promise<void> {
    await this.runSessionAction(session.id, () => this.sessionsService.removeUnlinked(session.id));
  }

  private async runSessionAction(id: string, action: () => Promise<void>): Promise<void> {
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
