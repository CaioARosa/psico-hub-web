import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';

import type { Patient } from '../domain/models';
import { newPatientDoc, patientFromDoc, patientToDoc } from '../domain/patient-doc';
import type { PatientInput } from '../domain/patient-form';
import { FIRESTORE } from './firebase';
import { RepriceService } from './reprice.service';
import { runWrite } from './safe-write';

const LOAD_ERROR = 'Não foi possível carregar os pacientes.';

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly db = inject(FIRESTORE);
  private readonly reprice = inject(RepriceService);

  private readonly patientsState = signal<Patient[]>([]);
  private readonly errorState = signal<string | null>(null);
  private readonly loadedState = signal(false);

  readonly patients = this.patientsState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** False até o primeiro resultado (ou erro) do listener. */
  readonly loaded = this.loadedState.asReadonly();

  constructor() {
    const unsubscribe = onSnapshot(
      query(collection(this.db, 'patients'), orderBy('name')),
      snapshot => {
        this.patientsState.set(snapshot.docs.map(d => patientFromDoc(d.id, d.data())));
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

  /** Id gerado uma vez por formulário de criação; repetir `create` com o mesmo id não duplica. */
  newId(): string {
    return doc(collection(this.db, 'patients')).id;
  }

  async create(id: string, input: PatientInput): Promise<void> {
    await runWrite(() => setDoc(doc(this.db, 'patients', id), newPatientDoc(input)));
  }

  /** Grava o paciente e, depois, reajusta as sessões agendadas; falha do reajuste sobe sem desfazer a gravação. */
  async update(id: string, input: PatientInput): Promise<void> {
    await runWrite(() => updateDoc(doc(this.db, 'patients', id), { ...patientToDoc(input) }));
    await this.reprice.repriceScheduled(id, input.agreement);
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await runWrite(() => updateDoc(doc(this.db, 'patients', id), { active }));
  }
}
