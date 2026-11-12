import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';

import type { Patient } from '../domain/models';
import { patientFromDoc, patientToDoc } from '../domain/patient-doc';
import type { PatientInput } from '../domain/patient-form';
import { FIRESTORE } from './firebase';

const LOAD_ERROR = 'Não foi possível carregar os pacientes.';
const SAVE_ERROR = 'Não foi possível salvar. Tente novamente.';

@Injectable({ providedIn: 'root' })
export class PatientsService {
  private readonly db = inject(FIRESTORE);

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

  async create(input: PatientInput): Promise<void> {
    await this.write(async () => {
      await addDoc(collection(this.db, 'patients'), { ...patientToDoc(input), active: true });
    });
  }

  async update(id: string, input: PatientInput): Promise<void> {
    await this.write(() => updateDoc(doc(this.db, 'patients', id), { ...patientToDoc(input) }));
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.write(() => updateDoc(doc(this.db, 'patients', id), { active }));
  }

  private async write(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch {
      throw new Error(SAVE_ERROR);
    }
  }
}
