import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';

import { pricingForAgreement } from '../domain/money';
import { monthWindow } from '../domain/month';
import type { ConfirmableStatus, Patient, Session } from '../domain/models';
import { sessionFromDoc } from '../domain/session-doc';
import { patientChangeUpdate, sessionStatusUpdate } from '../domain/session-update';
import { canConfirm } from '../domain/sessions-view';
import { FIRESTORE } from './firebase';
import { PatientsService } from './patients.service';
import { runWrite } from './safe-write';

const LOAD_ERROR = 'Não foi possível carregar as sessões.';
const UNIDENTIFIED_ERROR = 'Vincule um paciente a esta sessão antes de confirmá-la.';
const NOT_FOUND_ERROR = 'Sessão não encontrada. Atualize a página e tente novamente.';
const PATIENT_NOT_FOUND_ERROR = 'Paciente não encontrado. Atualize a página e tente novamente.';

/** Estado em tempo real das sessões de um mês; o listener vive até outro mês ser observado. */
export interface MonthWatch {
  readonly month: string;
  readonly sessions: Signal<Session[]>;
  /** False até o primeiro resultado (ou erro) do listener. */
  readonly loaded: Signal<boolean>;
  readonly error: Signal<string | null>;
}

/** Estado em tempo real de todas as sessões, ordenadas por `startsAt`. */
export interface AllSessionsWatch {
  readonly sessions: Signal<Session[]>;
  /** False até o primeiro resultado (ou erro) do listener. */
  readonly loaded: Signal<boolean>;
  readonly error: Signal<string | null>;
}

@Injectable({ providedIn: 'root' })
export class SessionsService {
  private readonly db = inject(FIRESTORE);

  private readonly patients = inject(PatientsService);

  private current: { watch: MonthWatch; unsubscribe: () => void } | null = null;

  private all: { watch: AllSessionsWatch; unsubscribe: () => void } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.current?.unsubscribe();
      this.all?.unsubscribe();
    });
  }

  /**
   * Observa as sessões do mês (`YYYY-MM`, janela em UTC-3). Idempotente para o mesmo mês;
   * ao trocar de mês, o listener anterior é encerrado. Não escreve em signals de forma síncrona,
   * então pode ser chamado dentro de `computed`.
   */
  watchMonth(month: string): MonthWatch {
    if (this.current?.watch.month === month) return this.current.watch;
    this.current?.unsubscribe();
    this.current = null;

    const { start, end } = monthWindow(month);
    const sessions = signal<Session[]>([]);
    const loaded = signal(false);
    const error = signal<string | null>(null);

    const unsubscribe = onSnapshot(
      query(
        collection(this.db, 'sessions'),
        where('startsAt', '>=', start),
        where('startsAt', '<', end),
        orderBy('startsAt'),
      ),
      snapshot => {
        sessions.set(snapshot.docs.map(d => sessionFromDoc(d.id, d.data())));
        error.set(null);
        loaded.set(true);
      },
      () => {
        error.set(LOAD_ERROR);
        loaded.set(true);
      },
    );

    const watch: MonthWatch = {
      month,
      sessions: sessions.asReadonly(),
      loaded: loaded.asReadonly(),
      error: error.asReadonly(),
    };
    this.current = { watch, unsubscribe };
    return watch;
  }

  sessionsOfMonth(month: string): Signal<Session[]> {
    return this.watchMonth(month).sessions;
  }

  /** Listener único da coleção inteira: criado na primeira chamada e reaproveitado depois. */
  watchAll(): AllSessionsWatch {
    if (this.all) return this.all.watch;

    const sessions = signal<Session[]>([]);
    const loaded = signal(false);
    const error = signal<string | null>(null);

    const unsubscribe = onSnapshot(
      query(collection(this.db, 'sessions'), orderBy('startsAt')),
      snapshot => {
        sessions.set(snapshot.docs.map(d => sessionFromDoc(d.id, d.data())));
        error.set(null);
        loaded.set(true);
      },
      () => {
        error.set(LOAD_ERROR);
        loaded.set(true);
      },
    );

    const watch: AllSessionsWatch = {
      sessions: sessions.asReadonly(),
      loaded: loaded.asReadonly(),
      error: error.asReadonly(),
    };
    this.all = { watch, unsubscribe };
    return watch;
  }

  /** Recusa sessão sem paciente, conferindo os dados que o serviço tem (não só a UI). */
  async setStatus(id: string, status: ConfirmableStatus): Promise<void> {
    const session = this.known(id);
    if (!session) throw new Error(NOT_FOUND_ERROR);
    if (!canConfirm(session)) throw new Error(UNIDENTIFIED_ERROR);
    const patient = this.patients.patients().find(p => p.id === session.patientId);
    if (!patient) throw new Error(PATIENT_NOT_FOUND_ERROR);
    await runWrite(() => updateDoc(doc(this.db, 'sessions', id), sessionStatusUpdate(status, patient)));
  }

  async linkPatient(id: string, patient: Patient): Promise<void> {
    await runWrite(() =>
      updateDoc(doc(this.db, 'sessions', id), {
        patientId: patient.id,
        ...pricingForAgreement(patient.agreement),
      }),
    );
  }

  /** Corrige vínculo errado em qualquer status, recalculando o preço pelo acordo do novo paciente. */
  async changePatient(id: string, patient: Patient): Promise<void> {
    const session = this.known(id);
    if (!session) throw new Error(NOT_FOUND_ERROR);
    if (!canConfirm(session)) throw new Error('Sessão sem paciente: use Vincular.');
    if (session.patientId === patient.id) throw new Error('Esta sessão já está com este paciente.');
    if (!patient.active) throw new Error('Escolha um paciente ativo.');
    await runWrite(() => updateDoc(doc(this.db, 'sessions', id), patientChangeUpdate(session, patient)));
  }

  async clearMissing(id: string): Promise<void> {
    await runWrite(() => updateDoc(doc(this.db, 'sessions', id), { missingFromCalendar: false }));
  }

  /** Remove sessão sem paciente que não está mais no Agenda. */
  async removeUnlinked(id: string): Promise<void> {
    const session = this.known(id);
    if (!session) throw new Error(NOT_FOUND_ERROR);
    if (canConfirm(session)) throw new Error('Sessão vinculada a paciente não pode ser removida.');
    await runWrite(() => deleteDoc(doc(this.db, 'sessions', id)));
  }

  private known(id: string): Session | undefined {
    return this.current?.watch.sessions().find(s => s.id === id);
  }
}
