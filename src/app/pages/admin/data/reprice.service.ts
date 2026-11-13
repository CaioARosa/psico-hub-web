import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';

import type { Agreement } from '../domain/models';
import { planReprice } from '../domain/reprice';
import { sessionFromDoc } from '../domain/session-doc';
import { FIRESTORE } from './firebase';
import { withTimeout } from './with-timeout';

const REPRICE_ERROR =
  'Paciente salvo, mas não foi possível atualizar as sessões agendadas. Salve novamente.';
const TIMEOUT_MS = 10_000;
const BATCH_LIMIT = 400;

@Injectable({ providedIn: 'root' })
export class RepriceService {
  private readonly db = inject(FIRESTORE);

  /** Regrava o acordo nas sessões ainda `scheduled` do paciente. Repetir após falha é seguro. */
  async repriceScheduled(patientId: string, agreement: Agreement): Promise<void> {
    try {
      const snapshot = await withTimeout(
        getDocs(
          query(
            collection(this.db, 'sessions'),
            where('patientId', '==', patientId),
            where('status', '==', 'scheduled'),
          ),
        ),
        TIMEOUT_MS,
        new Error(REPRICE_ERROR),
      );
      const sessions = snapshot.docs.map(d => sessionFromDoc(d.id, d.data()));
      const plan = planReprice(sessions, agreement);

      for (let start = 0; start < plan.length; start += BATCH_LIMIT) {
        const batch = writeBatch(this.db);
        for (const item of plan.slice(start, start + BATCH_LIMIT)) {
          batch.update(doc(this.db, 'sessions', item.id), {
            amountApplied: item.amountApplied,
            packageAmountApplied: item.packageAmountApplied,
          });
        }
        await withTimeout(batch.commit(), TIMEOUT_MS, new Error(REPRICE_ERROR));
      }
    } catch {
      throw new Error(REPRICE_ERROR);
    }
  }
}
