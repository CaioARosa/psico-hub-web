import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideCheck, lucideRefreshCw, lucideX } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardBadgeComponent, type ZardBadgeTypeVariants } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardEmptyComponent } from '@/shared/components/empty';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { CalendarSyncService } from '../data/calendar-sync.service';
import { PatientsService } from '../data/patients.service';
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
import type { Session, SessionStatus } from '../domain/models';
import { currentMonth } from '../domain/month';
import { rescheduleNote, statusLabel } from '../domain/sessions-view';
import { syncSummary, type SyncCounts } from '../domain/sync-summary';
import { SessionActionsComponent } from '../sessions/session-actions.component';

@Component({
  selector: 'app-admin-agenda',
  standalone: true,
  imports: [
    RouterLink,
    NgIcon,
    ZardAlertComponent,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardEmptyComponent,
    ZardSkeletonComponent,
    SessionActionsComponent,
    ...ZardCardImports,
  ],
  viewProviders: [provideIcons({ lucideCalendar, lucideCheck, lucideRefreshCw, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-3xl text-foreground tracking-tight">Agenda</h1>
          <p class="text-sm font-medium text-muted-foreground mt-0.5 tabular-nums">{{ label() }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex items-center rounded-xl border border-border bg-card p-1 gap-1">
            <button
              z-button
              zType="ghost"
              zSize="sm"
              type="button"
              class="rounded-lg px-2.5"
              (click)="shift(-1)"
            >
              ‹ Semana
            </button>
            <button
              z-button
              zType="ghost"
              zSize="sm"
              type="button"
              class="rounded-lg px-2.5"
              (click)="goToToday()"
            >
              Hoje
            </button>
            <button
              z-button
              zType="ghost"
              zSize="sm"
              type="button"
              class="rounded-lg px-2.5"
              (click)="shift(1)"
            >
              Semana ›
            </button>
          </div>

          <button
            z-button
            type="button"
            class="h-10 rounded-xl px-4"
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
          <p class="text-sm text-muted-foreground">Carregando agenda...</p>
          @for (i of [1, 2, 3]; track i) {
            <z-skeleton class="h-24 w-full rounded-2xl" />
          }
        </div>
      } @else if (days().length === 0) {
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
                    class="p-3.5 sm:px-4 transition-colors"
                    [attr.data-session-id]="session.id"
                    [attr.data-status]="session.status"
                    [class.cursor-pointer]="session.patientId !== null"
                    [class.hover:bg-muted/40]="session.patientId !== null"
                    [class.opacity-60]="session.status === 'rescheduled'"
                    (click)="onRowClick(session, $event)"
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
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-2">
                        <z-badge [zType]="badgeType(session.status)" [class]="badgeExtraClass(session.status)">
                          {{ statusText(session.status) }}
                        </z-badge>
                        @if (session.patientId === null) {
                          <a
                            [routerLink]="['/admin/sessoes']"
                            [queryParams]="{ mes: sessionMonth(session), aba: 'nao-identificados' }"
                            class="text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                            (click)="$event.stopPropagation()"
                          >
                            Resolver em Sessões
                          </a>
                        }
                      </div>
                    </div>

                    @if (session.patientId !== null && expandedId() === session.id) {
                      <div
                        class="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2"
                        (click)="$event.stopPropagation()"
                      >
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
    </section>
  `,
})
export class AgendaComponent {
  protected readonly sessionsService = inject(SessionsService);
  protected readonly patientsService = inject(PatientsService);
  private readonly calendarSync = inject(CalendarSyncService);

  readonly watch = this.sessionsService.watchAll();
  readonly now = signal(new Date());
  readonly window = signal<WeekWindow>(weekWindow(this.now()));
  readonly expandedId = signal<string | null>(null);

  readonly syncing = signal(false);
  readonly syncMessage = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);

  readonly busyId = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly label = computed(() => weekLabel(this.window()));
  readonly days = computed(() => groupByDay(this.watch.sessions(), this.window(), this.now()));
  readonly patientNames = computed(
    () => new Map(this.patientsService.patients().map(p => [p.id, p.name])),
  );

  shift(delta: number): void {
    const nextStart = shiftWeek(this.window().start, delta);
    this.window.set(weekWindow(nextStart));
    this.expandedId.set(null);
    this.actionMessage.set(null);
    this.actionError.set(null);
  }

  goToToday(): void {
    const current = new Date();
    this.now.set(current);
    this.window.set(weekWindow(current));
    this.expandedId.set(null);
    this.actionMessage.set(null);
    this.actionError.set(null);
  }

  onRowClick(session: Session, event?: Event): void {
    if (session.patientId === null) return;
    if (event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('app-session-actions')) return;
    }
    this.expandedId.update(current => (current === session.id ? null : session.id));
  }

  protected patientName(session: Session): string {
    if (session.patientId === null) return 'Paciente não identificado';
    return this.patientNames().get(session.patientId) ?? 'Paciente não identificado';
  }

  protected formatTime(date: Date): string {
    return timeOf(date);
  }

  protected noteOf(session: Session): string | null {
    return rescheduleNote(session);
  }

  protected statusText(status: SessionStatus): string {
    return statusLabel(status);
  }

  protected sessionMonth(session: Session): string {
    return currentMonth(session.startsAt);
  }

  protected badgeType(status: SessionStatus): ZardBadgeTypeVariants {
    if (status === 'cancelled') return 'outline';
    return 'secondary';
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

  async syncCalendar(): Promise<void> {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.syncError.set(null);
    this.syncMessage.set(null);
    try {
      const months = monthsInWindow(this.window());
      const totals: SyncCounts = { created: 0, updated: 0, unidentified: 0, missing: 0 };
      for (const month of months) {
        const result = await this.calendarSync.sync(month);
        totals.created += result.created;
        totals.updated += result.updated;
        totals.unidentified += result.unidentified;
        totals.missing += result.missing;
      }
      this.syncMessage.set(syncSummary(totals));
    } catch (err) {
      this.syncError.set(
        err instanceof Error ? err.message : 'Falha ao sincronizar a agenda. Tente novamente.',
      );
    } finally {
      this.syncing.set(false);
    }
  }
}
