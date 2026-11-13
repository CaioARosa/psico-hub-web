import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';

import type { Payment } from '../domain/models';
import { paymentFromDoc, paymentToDoc } from '../domain/payment-doc';
import type { PaymentInput } from '../domain/payment-form';
import { FIRESTORE } from './firebase';
import { runWrite } from './safe-write';

const LOAD_ERROR = 'Não foi possível carregar os pagamentos.';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly db = inject(FIRESTORE);

  private readonly paymentsState = signal<Payment[]>([]);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedState = signal(false);

  readonly payments = this.paymentsState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** False até o primeiro resultado (ou erro) do listener. */
  readonly loaded = this.loadedState.asReadonly();

  constructor() {
    const unsubscribe = onSnapshot(
      query(collection(this.db, 'payments'), orderBy('paidAt', 'desc')),
      snapshot => {
        this.paymentsState.set(snapshot.docs.map(d => paymentFromDoc(d.id, d.data())));
        this.errorState.set(null);
        this.loadedState.set(true);
      },
      () => {
        this.errorState.set(LOAD_ERROR);
        this.loadedState.set(true);
      },
    );
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  /** Id gerado uma vez por formulário; repetir `create` com o mesmo id não duplica. */
  newId(): string {
    return doc(collection(this.db, 'payments')).id;
  }

  async create(id: string, input: PaymentInput): Promise<void> {
    await runWrite(() => setDoc(doc(this.db, 'payments', id), paymentToDoc(input)));
  }

  async update(id: string, input: PaymentInput): Promise<void> {
    await runWrite(() => updateDoc(doc(this.db, 'payments', id), { ...paymentToDoc(input) }));
  }

  async remove(id: string): Promise<void> {
    await runWrite(() => deleteDoc(doc(this.db, 'payments', id)));
  }
}
