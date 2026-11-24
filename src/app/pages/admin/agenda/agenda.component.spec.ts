import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CalendarSyncService } from '../data/calendar-sync.service';
import { PatientsService } from '../data/patients.service';
import { RescheduleService } from '../data/reschedule.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import { weekWindow } from '../domain/agenda';
import type { Patient, Session } from '../domain/models';
import { AgendaComponent } from './agenda.component';

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

const secondPatient: Patient = {
  ...activePatient,
  id: 'p2',
  name: 'Bruno Lima',
};

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(b => b.textContent?.trim() === text);
}

function makeSession(overrides: Partial<Session> & { id: string; startsAt: Date }): Session {
  return {
    patientId: 'p1',
    calendarTitle: 'Consulta - Ana Paula',
    status: 'scheduled',
    amountApplied: 15000,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
    rescheduledToId: null,
    rescheduledToStartsAt: null,
    statusBeforeReschedule: null,
    rescheduledFromId: null,
    rescheduledFromStartsAt: null,
    ...overrides,
  };
}

describe('AgendaComponent', () => {
  let sessionsSignal = signal<Session[]>([]);
  let loadedSignal = signal(true);
  let errorSignal = signal<string | null>(null);
  let patientsSignal = signal<Patient[]>([activePatient, secondPatient]);
  let syncCalls: string[] = [];
  let syncImpl: (
    month: string,
  ) => Promise<{ created: number; updated: number; unidentified: number; missing: number }>;

  beforeEach(() => {
    sessionsSignal = signal<Session[]>([]);
    loadedSignal = signal(true);
    errorSignal = signal<string | null>(null);
    patientsSignal = signal<Patient[]>([activePatient, secondPatient]);
    syncCalls = [];
    syncImpl = async month => {
      syncCalls.push(month);
      return { created: 2, updated: 1, unidentified: 0, missing: 0 };
    };

    const fakeSessionsService: Pick<SessionsService, 'watchAll' | 'setStatus' | 'changePatient'> = {
      watchAll: (): AllSessionsWatch => ({
        sessions: sessionsSignal.asReadonly(),
        loaded: loadedSignal.asReadonly(),
        error: errorSignal.asReadonly(),
      }),
      setStatus: async () => {},
      changePatient: async () => {},
    };

    const fakePatientsService: Pick<PatientsService, 'patients' | 'loaded' | 'error'> = {
      patients: patientsSignal.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    const fakeCalendarSync: Pick<CalendarSyncService, 'sync'> = {
      sync: month => syncImpl(month),
    };

    const fakeReschedule: Pick<RescheduleService, 'reschedule'> = {
      reschedule: async (_id, startsAt) => ({ kind: 'ok', newSessionId: 'new-1', startsAt }),
    };

    TestBed.configureTestingModule({
      imports: [AgendaComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsService, useValue: fakeSessionsService },
        { provide: PatientsService, useValue: fakePatientsService },
        { provide: CalendarSyncService, useValue: fakeCalendarSync },
        { provide: RescheduleService, useValue: fakeReschedule },
      ],
    });
  });

  it('mostra os dias da semana atual, avança com Semana › e volta com Hoje', () => {
    const now = new Date();
    const currentWin = weekWindow(now);
    const nextWinStart = new Date(currentWin.start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sessionThisWeek = makeSession({
      id: 's-this',
      patientId: 'p1',
      startsAt: new Date(currentWin.start.getTime() + 12 * 60 * 60 * 1000),
    });
    const sessionNextWeek = makeSession({
      id: 's-next',
      patientId: 'p2',
      startsAt: new Date(nextWinStart.getTime() + 12 * 60 * 60 * 1000),
    });
    sessionsSignal.set([sessionThisWeek, sessionNextWeek]);

    const fixture = TestBed.createComponent(AgendaComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent ?? '').toContain('Ana Paula');
    expect(root.textContent ?? '').not.toContain('Bruno Lima');

    buttonByText(root, 'Semana ›')?.click();
    fixture.detectChanges();

    expect(root.textContent ?? '').toContain('Bruno Lima');
    expect(root.textContent ?? '').not.toContain('Ana Paula');

    buttonByText(root, 'Hoje')?.click();
    fixture.detectChanges();

    expect(root.textContent ?? '').toContain('Ana Paula');
    expect(root.textContent ?? '').not.toContain('Bruno Lima');
  });

  it('clicar numa linha com paciente abre app-session-actions só nela e clicar em outra troca a aberta', () => {
    const win = weekWindow(new Date('2026-11-25T15:00:00.000Z'));
    sessionsSignal.set([
      makeSession({ id: 's-1', patientId: 'p1', startsAt: new Date('2026-11-23T13:00:00.000Z') }),
      makeSession({ id: 's-2', patientId: 'p2', startsAt: new Date('2026-11-24T13:00:00.000Z') }),
    ]);

    const fixture = TestBed.createComponent(AgendaComponent);
    fixture.componentInstance.window.set(win);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('app-session-actions').length).toBe(0);

    const row1 = root.querySelector<HTMLElement>('[data-session-id="s-1"]');
    const row2 = root.querySelector<HTMLElement>('[data-session-id="s-2"]');

    row1?.click();
    fixture.detectChanges();
    expect(row1?.querySelector('app-session-actions')).not.toBeNull();
    expect(row2?.querySelector('app-session-actions')).toBeNull();

    row2?.click();
    fixture.detectChanges();
    expect(row1?.querySelector('app-session-actions')).toBeNull();
    expect(row2?.querySelector('app-session-actions')).not.toBeNull();
  });

  it('linha sem paciente mostra Paciente não identificado e link Resolver em Sessões', () => {
    const win = weekWindow(new Date('2026-11-25T15:00:00.000Z'));
    sessionsSignal.set([
      makeSession({
        id: 's-unid',
        patientId: null,
        startsAt: new Date('2026-11-25T18:00:00.000Z'),
      }),
    ]);

    const fixture = TestBed.createComponent(AgendaComponent);
    fixture.componentInstance.window.set(win);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent ?? '').toContain('Paciente não identificado');
    const link = Array.from(root.querySelectorAll('a')).find(
      a => a.textContent?.trim() === 'Resolver em Sessões',
    );
    expect(link).toBeDefined();
    expect(link?.getAttribute('href')).toContain('/admin/sessoes?mes=2026-11&aba=nao-identificados');
  });

  it('exibe mensagem de semana vazia quando não há sessões', () => {
    sessionsSignal.set([]);
    const fixture = TestBed.createComponent(AgendaComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
      'Nenhuma sessão nesta semana.',
    );
  });

  it('Sincronizar agenda em semana que cruza meses sincroniza os 2 meses e soma o resumo', async () => {
    const crossMonthWindow = weekWindow(new Date('2026-12-02T15:00:00.000Z')); // 30 nov – 6 dez 2026
    const fixture = TestBed.createComponent(AgendaComponent);
    fixture.componentInstance.window.set(crossMonthWindow);
    fixture.detectChanges();

    await fixture.componentInstance.syncCalendar();
    fixture.detectChanges();

    expect(syncCalls).toEqual(['2026-11', '2026-12']);
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
      '4 novas, 2 atualizadas, 0 sem paciente, 0 removidas do Agenda',
    );
  });
});
