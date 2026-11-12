import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CalendarSyncService } from '../data/calendar-sync.service';
import { PatientsService } from '../data/patients.service';
import { SessionsService, type MonthWatch } from '../data/sessions.service';
import type { Patient, Session } from '../domain/models';
import { SessionsComponent } from './sessions.component';

const activePatient: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: {
    type: 'per_session',
    amount: 15000,
    sessionsPerMonth: 4,
    chargeNoShow: true,
  },
};

const inactivePatient: Patient = {
  ...activePatient,
  id: 'p2',
  name: 'Carlos Inativo',
  active: false,
};

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
    calendarTitle: 'Consulta [Individual] - Ana Paula',
    status: 'scheduled',
    amountApplied: 15000,
    missingFromCalendar: false,
    ...overrides,
  };
}

describe('SessionsComponent', () => {
  let sessionsSignal = signal<Session[]>([]);
  let loadedSignal = signal(true);
  let errorSignal = signal<string | null>(null);
  let patientsSignal = signal<Patient[]>([activePatient, inactivePatient]);

  let watchMonthCalls: string[] = [];
  let setStatusCalls: Array<{ id: string; status: string }> = [];
  let linkPatientCalls: Array<{ id: string; patient: Patient }> = [];
  let clearMissingCalls: string[] = [];
  let syncImpl: (month: string) => Promise<{ created: number; updated: number; unidentified: number; missing: number }>;

  beforeEach(() => {
    sessionsSignal = signal<Session[]>([]);
    loadedSignal = signal(true);
    errorSignal = signal<string | null>(null);
    patientsSignal = signal<Patient[]>([activePatient, inactivePatient]);
    watchMonthCalls = [];
    setStatusCalls = [];
    linkPatientCalls = [];
    clearMissingCalls = [];
    syncImpl = async () => ({ created: 3, updated: 1, unidentified: 1, missing: 0 });

    const fakeSessionsService: Pick<
      SessionsService,
      'watchMonth' | 'sessionsOfMonth' | 'setStatus' | 'linkPatient' | 'clearMissing'
    > = {
      watchMonth: (month: string): MonthWatch => {
        watchMonthCalls.push(month);
        return {
          month,
          sessions: sessionsSignal.asReadonly(),
          loaded: loadedSignal.asReadonly(),
          error: errorSignal.asReadonly(),
        };
      },
      sessionsOfMonth: () => sessionsSignal.asReadonly(),
      setStatus: async (id, status) => {
        const s = sessionsSignal().find(item => item.id === id);
        if (!s || s.patientId === null) {
          throw new Error('Vincule um paciente a esta sessão antes de confirmá-la.');
        }
        setStatusCalls.push({ id, status });
      },
      linkPatient: async (id, patient) => {
        linkPatientCalls.push({ id, patient });
      },
      clearMissing: async id => {
        clearMissingCalls.push(id);
      },
    };

    const fakePatientsService: Pick<PatientsService, 'patients' | 'loaded' | 'error'> = {
      patients: patientsSignal.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    const fakeCalendarSync: Pick<CalendarSyncService, 'sync'> = {
      sync: (month: string) => syncImpl(month),
    };

    TestBed.configureTestingModule({
      imports: [SessionsComponent],
      providers: [
        { provide: SessionsService, useValue: fakeSessionsService },
        { provide: PatientsService, useValue: fakePatientsService },
        { provide: CalendarSyncService, useValue: fakeCalendarSync },
      ],
    });
  });

  it('sincroniza a agenda e exibe o resumo do resultado', async () => {
    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    await fixture.componentInstance.syncCalendar();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('3 novas, 1 atualizada, 1 sem paciente, 0 removidas do Agenda');
  });

  it('exibe erro amigável quando a sincronização falha com 503', async () => {
    syncImpl = async () => {
      throw new Error('Google Agenda não configurado.');
    };
    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    await fixture.componentInstance.syncCalendar();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Google Agenda não configurado.');
  });

  it('impede confirmar sessão não identificada e permite vincular paciente ativo', async () => {
    const unidentified = makeSession({
      id: 's-unid',
      patientId: null,
      calendarTitle: 'Consulta - Desconhecido',
    });
    sessionsSignal.set([unidentified]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    await fixture.componentInstance.changeStatus(unidentified, 'done');
    fixture.detectChanges();

    expect(setStatusCalls).toEqual([]);
    expect(fixture.componentInstance.actionError()).toBe(
      'Vincule um paciente a esta sessão antes de confirmá-la.',
    );

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('select option'),
    ).map(o => o.textContent?.trim());
    expect(options).toContain('Ana Paula');
    expect(options).not.toContain('Carlos Inativo');

    fixture.componentInstance.selectPatient('s-unid', 'p1');
    await fixture.componentInstance.linkSelectedPatient(unidentified);

    expect(linkPatientCalls).toEqual([{ id: 's-unid', patient: activePatient }]);
  });

  it('exibe selo Removida do Agenda e ações Manter e Cancelar sessão', async () => {
    const missing = makeSession({
      id: 's-miss',
      missingFromCalendar: true,
    });
    sessionsSignal.set([missing]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Removida do Agenda');

    await fixture.componentInstance.keepSession(missing);
    expect(clearMissingCalls).toEqual(['s-miss']);

    await fixture.componentInstance.changeStatus(missing, 'cancelled');
    expect(setStatusCalls).toEqual([{ id: 's-miss', status: 'cancelled' }]);
  });
});
