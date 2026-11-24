import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CalendarSyncService } from '../data/calendar-sync.service';
import { PatientsService } from '../data/patients.service';
import { RescheduleService } from '../data/reschedule.service';
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

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(b => b.textContent?.trim() === text);
}

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
    calendarTitle: 'Consulta [Individual] - Ana Paula',
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

describe('SessionsComponent', () => {
  let sessionsSignal = signal<Session[]>([]);
  let loadedSignal = signal(true);
  let errorSignal = signal<string | null>(null);
  let patientsSignal = signal<Patient[]>([activePatient, inactivePatient]);

  let watchMonthCalls: string[] = [];
  let setStatusCalls: Array<{ id: string; status: string }> = [];
  let linkPatientCalls: Array<{ id: string; patient: Patient }> = [];
  let setStatusImpl: ((id: string, status: string) => Promise<void>) | null = null;
  let clearMissingCalls: string[] = [];
  let removeUnlinkedCalls: string[] = [];
  let queryParams: Record<string, string> = {};
  let syncImpl: (month: string) => Promise<{ created: number; updated: number; unidentified: number; missing: number }>;

  beforeEach(() => {
    sessionsSignal = signal<Session[]>([]);
    loadedSignal = signal(true);
    errorSignal = signal<string | null>(null);
    patientsSignal = signal<Patient[]>([activePatient, inactivePatient]);
    watchMonthCalls = [];
    setStatusCalls = [];
    linkPatientCalls = [];
    setStatusImpl = null;
    clearMissingCalls = [];
    removeUnlinkedCalls = [];
    queryParams = {};
    syncImpl = async () => ({ created: 3, updated: 1, unidentified: 1, missing: 0 });

    const fakeSessionsService: Pick<
      SessionsService,
      | 'watchMonth'
      | 'sessionsOfMonth'
      | 'setStatus'
      | 'linkPatient'
      | 'changePatient'
      | 'clearMissing'
      | 'removeUnlinked'
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
        if (setStatusImpl) return setStatusImpl(id, status);
        const s = sessionsSignal().find(item => item.id === id);
        if (!s || s.patientId === null) {
          throw new Error('Vincule um paciente a esta sessão antes de confirmá-la.');
        }
        setStatusCalls.push({ id, status });
      },
      linkPatient: async (id, patient) => {
        linkPatientCalls.push({ id, patient });
      },
      changePatient: async () => {},
      clearMissing: async id => {
        clearMissingCalls.push(id);
      },
      removeUnlinked: async id => {
        removeUnlinkedCalls.push(id);
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

    const fakeReschedule: Pick<RescheduleService, 'reschedule'> = {
      reschedule: async (_id, startsAt) => ({ kind: 'ok', newSessionId: 'new-id', startsAt }),
    };

    TestBed.configureTestingModule({
      imports: [SessionsComponent],
      providers: [
        { provide: SessionsService, useValue: fakeSessionsService },
        { provide: PatientsService, useValue: fakePatientsService },
        { provide: CalendarSyncService, useValue: fakeCalendarSync },
        { provide: RescheduleService, useValue: fakeReschedule },
        {
          provide: ActivatedRoute,
          useFactory: () => ({ snapshot: { queryParamMap: convertToParamMap(queryParams) } }),
        },
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

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#link-patient-s-unid [role="combobox"]')?.click();
    fixture.detectChanges();
    const options = Array.from(document.querySelectorAll('[role="option"]')).map(o => o.textContent?.trim());
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

  it('exibe microcopy explicando por que vincular sessão sem paciente identificado', () => {
    sessionsSignal.set([
      makeSession({
        id: 's-unid',
        patientId: null,
        calendarTitle: 'Consulta - Desconhecido',
      }),
    ]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect((root.textContent ?? '').replace(/\s+/g, ' ')).toContain(
      'O título do evento no Agenda não casou com nenhum cadastro. Vincule para liberar a confirmação e calcular o valor.',
    );
  });

  it('sessão Removida do Agenda sem paciente permite Remover em vez de Cancelar sessão', async () => {
    const unlinkedMissing = makeSession({
      id: 's-unid-miss',
      patientId: null,
      calendarTitle: 'Brás Engenharia',
      missingFromCalendar: true,
    });
    sessionsSignal.set([unlinkedMissing]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll('button'));
    const removeButton = buttons.find(b => b.textContent?.trim() === 'Remover');
    const cancelSessionButton = buttons.find(b => b.textContent?.trim() === 'Cancelar sessão');

    expect(cancelSessionButton).toBeUndefined();
    expect(removeButton).toBeDefined();
    expect(removeButton?.disabled).toBe(false);

    removeButton?.click();
    await fixture.whenStable();
    expect(removeUnlinkedCalls).toEqual(['s-unid-miss']);
  });

  it('renderiza as ações da sessão em cada card', () => {
    sessionsSignal.set([
      makeSession({ id: 's1' }),
      makeSession({ id: 's2', status: 'done' }),
      makeSession({ id: 's-unid', patientId: null, calendarTitle: 'Consulta - Desconhecido' }),
    ]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('z-card app-session-actions').length).toBe(3);
  });

  it('trava as ações de todos os cards enquanto uma gravação está em andamento', async () => {
    let resolveWrite!: () => void;
    setStatusImpl = () => new Promise<void>(resolve => (resolveWrite = resolve));
    sessionsSignal.set([makeSession({ id: 's-a' }), makeSession({ id: 's-b' })]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const cardButtons = (index: number) => {
      const card = root.querySelectorAll('app-session-actions')[index] as HTMLElement;
      return ['Realizada', 'Faltou', 'Cancelada'].map(text => buttonByText(card, text));
    };

    cardButtons(0)[0]?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.busyId()).toBe('s-a');
    for (const button of cardButtons(1)) expect(button?.disabled).toBe(true);

    resolveWrite();
    await new Promise(resolve => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.busyId()).toBeNull();
    for (const button of cardButtons(1)) expect(button?.disabled).toBe(false);
  });

  it('exibe o erro emitido pelas ações da sessão', async () => {
    setStatusImpl = async () => {
      throw new Error('Sem conexão.');
    };
    sessionsSignal.set([makeSession({ id: 's1' })]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'Realizada')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.actionError()).toBe('Sem conexão.');
    expect(root.textContent ?? '').toContain('Sem conexão.');
  });

  it('exibe selo Reagendada, nota de reagendamento na original e na nova, e alerta de sucesso de done', () => {
    sessionsSignal.set([
      makeSession({
        id: 's-old',
        status: 'rescheduled',
        rescheduledToId: 's-new',
        rescheduledToStartsAt: new Date('2026-11-26T23:00:00.000Z'),
        statusBeforeReschedule: 'no_show',
      }),
      makeSession({
        id: 's-new',
        status: 'scheduled',
        startsAt: new Date('2026-11-26T23:00:00.000Z'),
        rescheduledFromId: 's-old',
        rescheduledFromStartsAt: new Date('2026-11-23T22:00:00.000Z'),
      }),
    ]);

    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Reagendada');
    expect(text).toContain('Reagendada para qui, 26/nov, 20:00 (era Faltou)');
    expect(text).toContain('Reagendada de seg, 23/nov, 19:00');

    const actions = fixture.debugElement.children[0].query(
      el => el.name === 'app-session-actions',
    );
    actions.componentInstance.done.emit('Reagendada para qui, 03/dez, 19:00. (em dezembro)');
    fixture.detectChanges();

    const statusAlert = root.querySelector('z-alert[zrole="status"], [role="status"]');
    expect(statusAlert?.textContent ?? '').toContain(
      'Reagendada para qui, 03/dez, 19:00. (em dezembro)',
    );
  });

  it('inicializa mês e aba ativa a partir dos query params mes e aba', () => {
    queryParams = { mes: '2026-10', aba: 'nao-identificados' };
    const fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.month()).toBe('2026-10');
    expect(watchMonthCalls).toContain('2026-10');
    expect(fixture.componentInstance.activeTab()).toBe('unidentified');
  });
});
