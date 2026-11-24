import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SessionsService } from '../data/sessions.service';
import type { Patient, Session } from '../domain/models';
import { SessionActionsComponent } from './session-actions.component';

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

const otherPatient: Patient = {
  ...activePatient,
  id: 'p3',
  name: 'Bruno Lima',
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

describe('SessionActionsComponent', () => {
  let setStatusCalls: Array<{ id: string; status: string }> = [];
  let changePatientCalls: Array<{ id: string; patient: Patient }> = [];
  let setStatusError: Error | null = null;
  let doneEvents: Array<string | null> = [];
  let failedEvents: string[] = [];

  beforeEach(() => {
    setStatusCalls = [];
    changePatientCalls = [];
    setStatusError = null;
    doneEvents = [];
    failedEvents = [];

    const fakeSessionsService: Pick<SessionsService, 'setStatus' | 'changePatient'> = {
      setStatus: async (id, status) => {
        if (setStatusError) throw setStatusError;
        setStatusCalls.push({ id, status });
      },
      changePatient: async (id, patient) => {
        changePatientCalls.push({ id, patient });
      },
    };

    TestBed.configureTestingModule({
      imports: [SessionActionsComponent],
      providers: [{ provide: SessionsService, useValue: fakeSessionsService }],
    });
  });

  function mount(
    session: Session,
    patients: Patient[] = [activePatient, inactivePatient, otherPatient],
  ): ComponentFixture<SessionActionsComponent> {
    const fixture = TestBed.createComponent(SessionActionsComponent);
    fixture.componentRef.setInput('session', session);
    fixture.componentRef.setInput('patients', patients);
    fixture.componentInstance.done.subscribe(message => doneEvents.push(message));
    fixture.componentInstance.failed.subscribe(message => failedEvents.push(message));
    fixture.detectChanges();
    return fixture;
  }

  it('Realizada, Faltou e Cancelada gravam o status e emitem done', async () => {
    const fixture = mount(makeSession({ id: 's1' }));
    const root = fixture.nativeElement as HTMLElement;

    for (const [text, status] of [
      ['Realizada', 'done'],
      ['Faltou', 'no_show'],
      ['Cancelada', 'cancelled'],
    ] as const) {
      buttonByText(root, text)?.click();
      await fixture.whenStable();
      expect(setStatusCalls.at(-1)).toEqual({ id: 's1', status });
    }

    expect(doneEvents).toEqual([null, null, null]);
    expect(failedEvents).toEqual([]);
  });

  it('emite failed com a mensagem quando setStatus falha', async () => {
    setStatusError = new Error('Sem conexão.');
    const fixture = mount(makeSession({ id: 's1' }));

    buttonByText(fixture.nativeElement as HTMLElement, 'Realizada')?.click();
    await fixture.whenStable();

    expect(failedEvents).toEqual(['Sem conexão.']);
    expect(doneEvents).toEqual([]);
  });

  it('desabilita os botões de status em sessão reagendada', () => {
    const fixture = mount(makeSession({ id: 's1', status: 'rescheduled' }));
    const root = fixture.nativeElement as HTMLElement;

    for (const text of ['Realizada', 'Faltou', 'Cancelada']) {
      expect(buttonByText(root, text)?.disabled).toBe(true);
    }
  });

  it('desabilita os botões de status e esconde Trocar paciente em sessão sem paciente', () => {
    const fixture = mount(
      makeSession({ id: 's-unid', patientId: null, calendarTitle: 'Consulta - Desconhecido' }),
    );
    const root = fixture.nativeElement as HTMLElement;

    for (const text of ['Realizada', 'Faltou', 'Cancelada']) {
      expect(buttonByText(root, text)?.disabled).toBe(true);
    }
    expect(buttonByText(root, 'Trocar paciente')).toBeUndefined();
  });

  describe('Trocar paciente', () => {
    it('aparece em sessão com paciente em qualquer status', () => {
      for (const status of ['scheduled', 'done', 'no_show', 'cancelled'] as const) {
        const fixture = mount(makeSession({ id: `s-${status}`, status }));
        expect(buttonByText(fixture.nativeElement as HTMLElement, 'Trocar paciente')).toBeDefined();
      }
    });

    it('lista só pacientes ativos diferentes do atual e salva a troca', async () => {
      const fixture = mount(makeSession({ id: 's-linked', status: 'no_show' }));
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Trocar paciente')?.click();
      fixture.detectChanges();

      root.querySelector<HTMLButtonElement>('#change-patient-s-linked [role="combobox"]')?.click();
      fixture.detectChanges();
      const options = Array.from(document.querySelectorAll('[role="option"]')).map(o => o.textContent?.trim());
      expect(options).toContain('Bruno Lima');
      expect(options).not.toContain('Ana Paula');
      expect(options).not.toContain('Carlos Inativo');

      expect(buttonByText(root, 'Salvar')?.disabled).toBe(true);
      fixture.componentInstance.selectChangePatient('p3');
      fixture.detectChanges();

      buttonByText(root, 'Salvar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(changePatientCalls).toEqual([{ id: 's-linked', patient: otherPatient }]);
      expect(buttonByText(root, 'Salvar')).toBeUndefined();
      expect(doneEvents).toEqual([null]);
    });

    it('Cancelar fecha o seletor sem salvar', () => {
      const fixture = mount(makeSession({ id: 's-linked' }));
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Trocar paciente')?.click();
      fixture.detectChanges();
      expect(root.querySelector('#change-patient-s-linked')).not.toBeNull();

      buttonByText(root, 'Cancelar')?.click();
      fixture.detectChanges();

      expect(root.querySelector('#change-patient-s-linked')).toBeNull();
      expect(changePatientCalls).toEqual([]);
    });
  });
});
