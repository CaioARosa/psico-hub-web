import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';

import type { Agreement } from '../domain/models';
import { decideRepriceWrite, planReprice } from '../domain/reprice';
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
        const chunk = plan.slice(start, start + BATCH_LIMIT);
        await withTimeout(
          runTransaction(this.db, async tx => {
            const reads = await Promise.all(
              chunk.map(async item => {
                const ref = doc(this.db, 'sessions', item.id);
                return { ref, item, snapshot: await tx.get(ref) };
              }),
            );
            for (const read of reads) {
              const current = read.snapshot.exists() ? { status: read.snapshot.data()['status'] } : undefined;
              const write = decideRepriceWrite(current, read.item);
              if (write) tx.update(read.ref, write);
            }
          }),
          TIMEOUT_MS,
          new Error(REPRICE_ERROR),
        );
      }
    } catch {
      throw new Error(REPRICE_ERROR);
    }
  }
}
