import { Injectable, Injector, computed, inject, signal } from '@angular/core';

import { currentMonth, shiftMonth } from '../domain/month';
import type { SyncCounts } from '../domain/sync-summary';
import { needsAutoSync } from '../domain/sync-freshness';
import { CalendarSyncService, type SyncResult } from './calendar-sync.service';
import { CalendarSyncsService } from './calendar-syncs.service';

export const AUTO_SYNC_ERROR = 'Não foi possível atualizar a agenda agora.';

export interface AutoSyncOutcome {
  /** Meses que este `run` sincronizou. */
  synced: string[];
  /** Meses recentes demais, ou já em sincronização por outra chamada. */
  skipped: string[];
  totals: SyncCounts;
}

type Step = { kind: 'skipped' } | { kind: 'synced'; result: SyncResult };

function emptyOutcome(): AutoSyncOutcome {
  return { synced: [], skipped: [], totals: { created: 0, updated: 0, unidentified: 0, missing: 0 } };
}

/** Sincroniza o Google Agenda sem a Lays precisar clicar; os botões manuais usam `force`. */
@Injectable({ providedIn: 'root' })
export class AutoSyncService {
  private readonly calendarSync = inject(CalendarSyncService);
  private readonly injector = inject(Injector);

  private readonly inFlight = new Map<string, Promise<Step>>();
  private readonly active = signal(0);
  private readonly lastSyncedAtState = signal<Date | null>(null);
  private readonly errorState = signal<string | null>(null);
  private entered = false;

  readonly syncing = computed(() => this.active() > 0);
  /** Sincronização mais recente conhecida (lida do Firestore ou feita agora). */
  readonly lastSyncedAt = this.lastSyncedAtState.asReadonly();
  /** Só erros do modo automático; no modo `force` o erro propaga a quem chamou. */
  readonly error = this.errorState.asReadonly();

  /** Mês atual e o seguinte (UTC-3); só dispara uma vez por instância do serviço. */
  runOnEntry(now: Date = new Date()): Promise<AutoSyncOutcome> {
    if (this.entered) return Promise.resolve(emptyOutcome());
    this.entered = true;
    const month = currentMonth(now);
    return this.run([month, shiftMonth(month, 1)]);
  }

  async run(months: string[], options: { force?: boolean } = {}): Promise<AutoSyncOutcome> {
    const force = options.force === true;
    const outcome = emptyOutcome();
    if (!force) this.errorState.set(null);
    this.active.update(count => count + 1);
    try {
      for (const month of months) {
        const joined = this.inFlight.get(month);
        let step = joined ? await this.join(joined, force) : await this.start(month, force);
        // Clique manual que caiu numa automática que acabou pulando o mês: sincroniza de verdade.
        if (force && joined && step?.kind === 'skipped') step = await this.start(month, true);
        if (step === null) continue;
        if (step.kind === 'synced' && (force || !joined)) {
          outcome.synced.push(month);
          outcome.totals.created += step.result.created;
          outcome.totals.updated += step.result.updated;
          outcome.totals.unidentified += step.result.unidentified;
          outcome.totals.missing += step.result.missing;
        } else {
          outcome.skipped.push(month);
        }
      }
      return outcome;
    } finally {
      this.active.update(count => count - 1);
    }
  }

  private async join(pending: Promise<Step>, force: boolean): Promise<Step | null> {
    try {
      return await pending;
    } catch (error) {
      if (force) throw error;
      return { kind: 'skipped' };
    }
  }

  private async start(month: string, force: boolean): Promise<Step | null> {
    const promise = this.process(month, force);
    this.inFlight.set(month, promise);
    try {
      return await promise;
    } catch (error) {
      if (force) throw error;
      this.errorState.set(AUTO_SYNC_ERROR);
      return null;
    } finally {
      if (this.inFlight.get(month) === promise) this.inFlight.delete(month);
    }
  }

  private async process(month: string, force: boolean): Promise<Step> {
    if (!force) {
      const lastSyncedAt = await this.readLastSyncedAt(month);
      if (!needsAutoSync(lastSyncedAt, new Date())) {
        if (lastSyncedAt) this.remember(lastSyncedAt);
        return { kind: 'skipped' };
      }
    }
    const result = await this.calendarSync.sync(month);
    this.remember(new Date());
    return { kind: 'synced', result };
  }

  /** Falha de leitura vira "sem registro": é melhor sincronizar a mais do que deixar a agenda velha. */
  private async readLastSyncedAt(month: string): Promise<Date | null> {
    try {
      return await this.injector.get(CalendarSyncsService).lastSyncedAtOnce(month);
    } catch {
      return null;
    }
  }

  private remember(syncedAt: Date): void {
    const current = this.lastSyncedAtState();
    if (!current || syncedAt.getTime() > current.getTime()) this.lastSyncedAtState.set(syncedAt);
  }
}
