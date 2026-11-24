import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';

import { chargeFromDoc, chargeId, chargeToDoc } from '../domain/charge-doc';
import { FIRESTORE } from './firebase';
import { runWrite } from './safe-write';

const LOAD_ERROR = 'Não foi possível carregar as cobranças.';

/** Cobranças registradas de um mês (`charges`), por paciente. */
export interface ChargesWatch {
  readonly month: string;
  /** `patientId` → data da última cobrança do mês. */
  readonly charges: Signal<ReadonlyMap<string, Date>>;
  readonly loaded: Signal<boolean>;
  readonly error: Signal<string | null>;
}

@Injectable({ providedIn: 'root' })
export class ChargesService {
  private readonly db = inject(FIRESTORE);

  private current: { watch: ChargesWatch; unsubscribe: () => void } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.current?.unsubscribe());
  }

  /** Idempotente para o mesmo mês; ao trocar de mês, o listener anterior é encerrado. Pode ser chamado em `computed`. */
  watchMonth(month: string): ChargesWatch {
    if (this.current?.watch.month === month) return this.current.watch;
    this.current?.unsubscribe();

    const charges = signal<ReadonlyMap<string, Date>>(new Map());
    const loaded = signal(false);
    const error = signal<string | null>(null);
    const unsubscribe = onSnapshot(
      query(collection(this.db, 'charges'), where('month', '==', month)),
      snapshot => {
        const entries = snapshot.docs.map(d => chargeFromDoc(d.data()));
        charges.set(new Map(entries.map(charge => [charge.patientId, charge.chargedAt] as const)));
        error.set(null);
        loaded.set(true);
      },
      () => {
        error.set(LOAD_ERROR);
        loaded.set(true);
      },
    );

    const watch: ChargesWatch = {
      month,
      charges: charges.asReadonly(),
      loaded: loaded.asReadonly(),
      error: error.asReadonly(),
    };
    this.current = { watch, unsubscribe };
    return watch;
  }

  /** Marcar de novo o mesmo paciente e mês atualiza a data (id fixo), sem duplicar. */
  async markCharged(patientId: string, month: string, amount: number): Promise<void> {
    await runWrite(() =>
      setDoc(doc(this.db, 'charges', chargeId(patientId, month)), chargeToDoc(patientId, month, amount, new Date())),
    );
  }
}
