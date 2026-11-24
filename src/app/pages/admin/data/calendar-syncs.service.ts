import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

import { FIRESTORE } from './firebase';

/** Última sincronização de um mês (`calendarSyncs/{YYYY-MM}`, gravado pelo backend). */
export interface SyncWatch {
  readonly month: string;
  /** `null` quando o mês nunca foi sincronizado depois deste registro existir, ou se a leitura falhar. */
  readonly lastSyncedAt: Signal<Date | null>;
}

@Injectable({ providedIn: 'root' })
export class CalendarSyncsService {
  private readonly db = inject(FIRESTORE);

  private current: { watch: SyncWatch; unsubscribe: () => void } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.current?.unsubscribe());
  }

  /** Leitura única da última sincronização do mês (`null` se nunca sincronizou). Falhas de leitura propagam. */
  async lastSyncedAtOnce(month: string): Promise<Date | null> {
    const snapshot = await getDoc(doc(this.db, 'calendarSyncs', month));
    const value = snapshot.data()?.['syncedAt'];
    return value && typeof value.toDate === 'function' ? value.toDate() : null;
  }

  /** Idempotente para o mesmo mês; ao trocar de mês, o listener anterior é encerrado. Pode ser chamado em `computed`. */
  watchMonth(month: string): SyncWatch {
    if (this.current?.watch.month === month) return this.current.watch;
    this.current?.unsubscribe();

    const lastSyncedAt = signal<Date | null>(null);
    const unsubscribe = onSnapshot(
      doc(this.db, 'calendarSyncs', month),
      snapshot => {
        const value = snapshot.data()?.['syncedAt'];
        lastSyncedAt.set(value && typeof value.toDate === 'function' ? value.toDate() : null);
      },
      // Falha de leitura vira "sem registro": o painel pede para sincronizar em vez de esconder o aviso.
      () => lastSyncedAt.set(null),
    );

    const watch: SyncWatch = { month, lastSyncedAt: lastSyncedAt.asReadonly() };
    this.current = { watch, unsubscribe };
    return watch;
  }
}
