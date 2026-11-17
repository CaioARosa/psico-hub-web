import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { CalendarSyncService } from '../data/calendar-sync.service';
import { PatientsService } from '../data/patients.service';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import type { Session, SessionStatus } from '../domain/models';
import { currentMonth, isValidMonth } from '../domain/month';
import { canConfirm, formatSessionDateTime, groupSessions, statusLabel } from '../domain/sessions-view';
import { syncSummary } from '../domain/sync-summary';

export type SessionTab = 'all' | 'pending' | 'unidentified';

@Component({
  selector: 'app-admin-sessions',
  standalone: true,
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div class="space-y-1">
          <h1 class="font-display text-2xl text-[#1C221F] tracking-tight">Sessões</h1>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <div class="space-y-1.5">
            <label for="session-month" class="block text-sm font-medium text-[#1C221F]">Mês</label>
            <input
              id="session-month"
              name="month"
              type="month"
              class="min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
              [value]="month()"
              (change)="setMonth($any($event.target).value)"
            />
          </div>

          <button
            z-button
            type="button"
            class="min-h-11"
            [zLoading]="syncing()"
            [zDisabled]="syncing()"
            (click)="syncCalendar()"
          >
            {{ syncing() ? 'Sincronizando...' : 'Sincronizar agenda' }}
          </button>
        </div>
      </header>

      @if (syncMessage()) {
        <p role="status" class="text-sm rounded-xl bg-[#D4E6E1]/50 border border-[#4C645B]/20 px-3.5 py-2.5 text-[#1C221F]">
          {{ syncMessage() }}
        </p>
      }

      @if (syncError()) {
        <p role="alert" class="text-sm text-red-700">{{ syncError() }}</p>
      }

      <div role="tablist" aria-label="Filtro de sessões" class="flex flex-wrap gap-1 border-b border-[#4C645B]/15 pb-2">
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="activeTab() === 'all'"
          [class]="tabClass('all')"
          (click)="setTab('all')"
        >
          Todas ({{ groups().all.length }})
        </button>
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="activeTab() === 'pending'"
          [class]="tabClass('pending')"
          (click)="setTab('pending')"
        >
          Pendentes de confirmação ({{ groups().pending.length }})
        </button>
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="activeTab() === 'unidentified'"
          [class]="tabClass('unidentified')"
          (click)="setTab('unidentified')"
        >
          Não identificados ({{ groups().unidentified.length }})
        </button>
      </div>

      @if (actionError()) {
        <p role="alert" class="text-sm text-red-700">{{ actionError() }}</p>
      }

      @if (watch().error()) {
        <p role="alert" class="text-sm text-red-700">{{ watch().error() }}</p>
      } @else if (!watch().loaded()) {
        <p class="text-sm text-[#556661]">Carregando sessões...</p>
      } @else if (visibleSessions().length === 0) {
        <p class="text-sm text-[#556661]">{{ emptyMessage() }}</p>
      } @else {
        <ul class="space-y-3">
          @for (session of visibleSessions(); track session.id) {
            <li class="bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-4 space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-[#1C221F]">{{ patientName(session) }}</span>
                    <span [class]="badgeClass(session.status)">{{ statusText(session.status) }}</span>
                    @if (session.missingFromCalendar) {
                      <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Removida do Agenda
                      </span>
                    }
                  </div>
                  <p class="text-sm text-[#556661]">{{ formatDateTime(session.startsAt) }}</p>
                  @if (session.calendarTitle) {
                    <p class="text-xs text-[#556661]">{{ session.calendarTitle }}</p>
                  }
                </div>

                <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar status da sessão">
                  <button
                    z-button
                    [zType]="session.status === 'done' ? 'default' : 'outline'"
                    zSize="sm"
                    type="button"
                    [zDisabled]="!canConfirmSession(session) || busyId() === session.id"
                    (click)="changeStatus(session, 'done')"
                  >
                    Realizada
                  </button>
                  <button
                    z-button
                    [zType]="session.status === 'no_show' ? 'default' : 'outline'"
                    zSize="sm"
                    type="button"
                    [zDisabled]="!canConfirmSession(session) || busyId() === session.id"
                    (click)="changeStatus(session, 'no_show')"
                  >
                    Faltou
                  </button>
                  <button
                    z-button
                    [zType]="session.status === 'cancelled' ? 'default' : 'outline'"
                    zSize="sm"
                    type="button"
                    [zDisabled]="!canConfirmSession(session) || busyId() === session.id"
                    (click)="changeStatus(session, 'cancelled')"
                  >
                    Cancelada
                  </button>
                </div>
              </div>

              @if (!canConfirmSession(session)) {
                <div class="flex flex-wrap items-end gap-2 pt-2 border-t border-[#4C645B]/10">
                  <div class="space-y-1 grow max-w-xs">
                    <label [attr.for]="'link-patient-' + session.id" class="block text-xs font-medium text-[#1C221F]">
                      Vincular paciente ativo
                    </label>
                    <select
                      [id]="'link-patient-' + session.id"
                      [attr.aria-describedby]="'link-patient-hint-' + session.id"
                      class="w-full min-h-10 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-sm text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
                      [value]="selectedPatients()[session.id] ?? ''"
                      (change)="selectPatient(session.id, $any($event.target).value)"
                    >
                      <option value="">Selecione um paciente...</option>
                      @for (patient of activePatients(); track patient.id) {
                        <option [value]="patient.id">{{ patient.name }}</option>
                      }
                    </select>
                  </div>
                  <button
                    z-button
                    zSize="sm"
                    type="button"
                    [zLoading]="busyId() === session.id"
                    [zDisabled]="!selectedPatients()[session.id] || busyId() === session.id"
                    (click)="linkSelectedPatient(session)"
                  >
                    Vincular
                  </button>
                  <p [id]="'link-patient-hint-' + session.id" class="w-full text-xs text-[#556661]">
                    O título do evento no Agenda não casou com nenhum cadastro. Vincule para liberar a confirmação e calcular o valor.
                  </p>
                </div>
              }

              @if (session.missingFromCalendar) {
                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#4C645B]/10">
                  <span class="text-xs text-[#556661]">Este evento não está mais no Google Agenda.</span>
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
                    <button
                      z-button
                      zType="destructive"
                      zSize="sm"
                      type="button"
                      [zDisabled]="!canConfirmSession(session) || busyId() === session.id"
                      (click)="changeStatus(session, 'cancelled')"
                    >
                      Cancelar sessão
                    </button>
                  </div>
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class SessionsComponent {
  protected readonly sessionsService = inject(SessionsService);
  protected readonly patientsService = inject(PatientsService);
  private readonly calendarSync = inject(CalendarSyncService);

  readonly month = signal(currentMonth(new Date()));
  readonly watch = signal(this.sessionsService.watchMonth(this.month()));
  readonly activeTab = signal<SessionTab>('all');

  readonly syncing = signal(false);
  readonly syncMessage = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);

  readonly busyId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly selectedPatients = signal<Record<string, string | undefined>>({});

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
    this.actionError.set(null);
    this.watch.set(this.sessionsService.watchMonth(value));
  }

  setTab(tab: SessionTab): void {
    this.activeTab.set(tab);
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

  protected tabClass(tab: SessionTab): string {
    const base = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors';
    return this.activeTab() === tab
      ? `${base} bg-[#D4E6E1]/60 text-[#1C221F]`
      : `${base} text-[#556661] hover:bg-[#D4E6E1]/30`;
  }

  protected badgeClass(status: SessionStatus): string {
    const base = 'text-xs font-medium px-2 py-0.5 rounded-full';
    if (status === 'done') return `${base} bg-[#D4E6E1] text-[#1C221F]`;
    if (status === 'no_show') return `${base} bg-amber-100 text-amber-800`;
    if (status === 'cancelled') return `${base} bg-stone-200 text-stone-700`;
    return `${base} bg-[#4C645B]/10 text-[#556661]`;
  }

  async syncCalendar(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.syncError.set(null);
    this.syncMessage.set(null);
    try {
      const result = await this.calendarSync.sync(this.month());
      this.syncMessage.set(syncSummary(result));
    } catch (err) {
      this.syncError.set(
        err instanceof Error ? err.message : 'Falha ao sincronizar a agenda. Tente novamente.',
      );
    } finally {
      this.syncing.set(false);
    }
  }

  async changeStatus(session: Session, status: Exclude<SessionStatus, 'scheduled'>): Promise<void> {
    if (this.busyId() !== null) return;
    if (!canConfirm(session)) {
      this.actionError.set('Vincule um paciente a esta sessão antes de confirmá-la.');
      return;
    }
    this.actionError.set(null);
    this.busyId.set(session.id);
    try {
      await this.sessionsService.setStatus(session.id, status);
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
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.busyId.set(null);
    }
  }

  async keepSession(session: Session): Promise<void> {
    if (this.busyId() !== null) return;
    this.actionError.set(null);
    this.busyId.set(session.id);
    try {
      await this.sessionsService.clearMissing(session.id);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.busyId.set(null);
    }
  }
}
