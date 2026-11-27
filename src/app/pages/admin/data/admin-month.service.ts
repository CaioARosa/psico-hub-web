import { Injectable, computed, inject, signal } from '@angular/core';

import { currentMonth, isValidMonth, shiftMonth } from '../domain/month';
import { AutoSyncService, type AutoSyncOutcome } from './auto-sync.service';

/** Mês ativo único compartilhado entre Início, Atendimentos e Financeiro no `/admin`. */
@Injectable({ providedIn: 'root' })
export class AdminMonthService {
  private readonly autoSync = inject(AutoSyncService);
  private readonly monthState = signal(currentMonth(new Date()));

  readonly month = this.monthState.asReadonly();
  readonly isCurrentMonth = computed(() => this.monthState() === currentMonth(new Date()));

  setMonth(value: string): void {
    if (!isValidMonth(value) || value === this.monthState()) return;
    this.monthState.set(value);
    void this.autoSync.run([value]);
  }

  shift(delta: number): void {
    this.setMonth(shiftMonth(this.monthState(), delta));
  }

  resetToCurrent(): void {
    this.setMonth(currentMonth(new Date()));
  }

  syncCurrentMonthForce(): Promise<AutoSyncOutcome> {
    return this.autoSync.run([this.monthState()], { force: true });
  }
}
