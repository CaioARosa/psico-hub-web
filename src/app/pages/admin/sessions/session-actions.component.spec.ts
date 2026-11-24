import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { RescheduleService, type RescheduleResult } from '../data/reschedule.service';
import { SessionsService } from '../data/sessions.service';
import { zonedDateTime } from '../domain/datetime';
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
  let rescheduleCalls: Array<{ id: string; startsAt: Date; force: boolean }> = [];
  let setStatusError: Error | null = null;
  let changePatientError: Error | null = null;
  let rescheduleImpl: (id: string, startsAt: Date, force?: boolean) => Promise<RescheduleResult>;
  let doneEvents: Array<string | null> = [];
  let failedEvents: string[] = [];
  let workingEvents: boolean[] = [];

  beforeEach(() => {
    setStatusCalls = [];
    changePatientCalls = [];
    rescheduleCalls = [];
    setStatusError = null;
    changePatientError = null;
    rescheduleImpl = async (id, startsAt, force = false) => {
      rescheduleCalls.push({ id, startsAt, force });
      return { kind: 'ok', newSessionId: 'new-1', startsAt };
    };
    doneEvents = [];
    failedEvents = [];
    workingEvents = [];

    const fakeSessionsService: Pick<SessionsService, 'setStatus' | 'changePatient'> = {
      setStatus: async (id, status) => {
        if (setStatusError) throw setStatusError;
        setStatusCalls.push({ id, status });
      },
      changePatient: async (id, patient) => {
        if (changePatientError) throw changePatientError;
        changePatientCalls.push({ id, patient });
      },
    };

    const fakeRescheduleService: Pick<RescheduleService, 'reschedule'> = {
      reschedule: (id, startsAt, force) => rescheduleImpl(id, startsAt, force),
    };

    TestBed.configureTestingModule({
      imports: [SessionActionsComponent],
      providers: [
        { provide: SessionsService, useValue: fakeSessionsService },
        { provide: RescheduleService, useValue: fakeRescheduleService },
      ],
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
    fixture.componentInstance.workingChange.subscribe(working => workingEvents.push(working));
    fixture.detectChanges();
    return fixture;
  }

  it('Realizada, Faltou e Cancelada gravam o status, emitem workingChange e done', async () => {
    const fixture = mount(makeSession({ id: 's1', status: 'done' }));
    const root = fixture.nativeElement as HTMLElement;

    expect(buttonByText(root, 'Realizada')?.getAttribute('aria-pressed')).toBe('true');
    expect(buttonByText(root, 'Faltou')?.getAttribute('aria-pressed')).toBe('false');
    expect(buttonByText(root, 'Cancelada')?.getAttribute('aria-pressed')).toBe('false');

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
    expect(workingEvents).toEqual([true, false, true, false, true, false]);
    expect(failedEvents).toEqual([]);
  });

  it('emite failed com a mensagem quando setStatus falha e reabilita os botões', async () => {
    setStatusError = new Error('Sem conexão.');
    const fixture = mount(makeSession({ id: 's1' }));
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'Realizada')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(failedEvents).toEqual(['Sem conexão.']);
    expect(doneEvents).toEqual([]);
    expect(workingEvents).toEqual([true, false]);
    for (const text of ['Realizada', 'Faltou', 'Cancelada', 'Trocar paciente']) {
      expect(buttonByText(root, text)?.disabled).toBe(false);
    }
  });

  it('desabilita todos os botões quando locked é true', () => {
    const fixture = mount(makeSession({ id: 's1' }));
    fixture.componentRef.setInput('locked', true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    for (const text of ['Realizada', 'Faltou', 'Cancelada', 'Trocar paciente']) {
      expect(buttonByText(root, text)?.disabled).toBe(true);
    }
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

    it('mantém o seletor aberto com a seleção quando changePatient falha', async () => {
      changePatientError = new Error('Falha ao trocar.');
      const fixture = mount(makeSession({ id: 's-linked' }));
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Trocar paciente')?.click();
      fixture.componentInstance.selectChangePatient('p3');
      fixture.detectChanges();

      buttonByText(root, 'Salvar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(failedEvents).toEqual(['Falha ao trocar.']);
      expect(root.querySelector('#change-patient-s-linked')).not.toBeNull();
      expect(fixture.componentInstance.changeSelection()).toBe('p3');
    });

    it('fecha o seletor quando o input session muda para outra sessão', () => {
      const fixture = mount(makeSession({ id: 's-1' }));
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Trocar paciente')?.click();
      fixture.componentInstance.selectChangePatient('p3');
      fixture.detectChanges();
      expect(root.querySelector('#change-patient-s-1')).not.toBeNull();

      fixture.componentRef.setInput('session', makeSession({ id: 's-2' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.mode()).toBeNull();
      expect(fixture.componentInstance.changeSelection()).toBeNull();
      expect(root.querySelector('#change-patient-s-2')).toBeNull();
    });
  });

  describe('Reagendar', () => {
    it('exibe botão Reagendar apenas para scheduled, no_show e cancelled com paciente', () => {
      for (const status of ['scheduled', 'no_show', 'cancelled'] as const) {
        const fixture = mount(makeSession({ id: `s-${status}`, status }));
        expect(buttonByText(fixture.nativeElement as HTMLElement, 'Reagendar')).toBeDefined();
      }

      for (const status of ['done', 'rescheduled'] as const) {
        const fixture = mount(makeSession({ id: `s-${status}`, status }));
        expect(buttonByText(fixture.nativeElement as HTMLElement, 'Reagendar')).toBeUndefined();
      }

      const unlinked = mount(makeSession({ id: 's-unid', patientId: null }));
      expect(buttonByText(unlinked.nativeElement as HTMLElement, 'Reagendar')).toBeUndefined();
    });

    it('preenche data padrão (+7 dias), horário original e texto de apoio ao abrir', () => {
      const fixture = mount(
        makeSession({
          id: 's-orig',
          startsAt: new Date('2026-11-26T22:00:00.000Z'),
        }),
      );
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Reagendar')?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.rescheduleDateKey()).toBe('2026-12-03');
      expect(fixture.componentInstance.rescheduleTime()).toBe('19:00');
      const timeInput = root.querySelector<HTMLInputElement>('input[type="time"]');
      expect(timeInput?.value).toBe('19:00');
      expect((root.textContent ?? '').replace(/\s+/g, ' ')).toContain(
        'A sessão de 26/nov fica como Reagendada e não é cobrada. O evento no Google Agenda é movido.',
      );
    });

    it('reagenda para outro mês e emite done com o mês por extenso', async () => {
      const fixture = mount(
        makeSession({
          id: 's-orig',
          startsAt: new Date('2026-11-26T22:00:00.000Z'),
        }),
      );
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Reagendar')?.click();
      fixture.detectChanges();

      buttonByText(root, 'Reagendar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rescheduleCalls).toEqual([
        {
          id: 's-orig',
          startsAt: zonedDateTime('2026-12-03', '19:00'),
          force: false,
        },
      ]);
      expect(doneEvents).toEqual(['Reagendada para qui, 03/dez, 19:00. (em dezembro)']);
      expect(fixture.componentInstance.mode()).toBeNull();
    });

    it('exibe alerta de conflito e permite Reagendar mesmo assim ou Escolher outro horário', async () => {
      let callCount = 0;
      rescheduleImpl = async (id, startsAt, force = false) => {
        callCount++;
        rescheduleCalls.push({ id, startsAt, force });
        if (!force) {
          return {
            kind: 'conflict',
            conflicts: [
              {
                title: 'Psicoterapia Bruno',
                startsAt: new Date('2026-12-03T22:00:00.000Z'),
                endsAt: new Date('2026-12-03T22:50:00.000Z'),
              },
            ],
          };
        }
        return { kind: 'ok', newSessionId: 'new-2', startsAt };
      };

      const fixture = mount(
        makeSession({
          id: 's-orig',
          startsAt: new Date('2026-11-26T22:00:00.000Z'),
        }),
      );
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Reagendar')?.click();
      fixture.detectChanges();

      buttonByText(root, 'Reagendar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const textAfterConflict = (root.textContent ?? '').replace(/\s+/g, ' ');
      expect(textAfterConflict).toContain('Já existe compromisso nesse horário:');
      expect(textAfterConflict).toContain('• Psicoterapia Bruno — 03/dez, 19:00–19:50');
      expect(doneEvents).toEqual([]);

      buttonByText(root, 'Escolher outro horário')?.click();
      fixture.detectChanges();
      expect((root.textContent ?? '').replace(/\s+/g, ' ')).not.toContain(
        'Já existe compromisso nesse horário:',
      );
      expect(fixture.componentInstance.mode()).toBe('reschedule');

      buttonByText(root, 'Reagendar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(callCount).toBe(2);

      buttonByText(root, 'Reagendar mesmo assim')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rescheduleCalls.at(-1)).toEqual({
        id: 's-orig',
        startsAt: zonedDateTime('2026-12-03', '19:00'),
        force: true,
      });
      expect(doneEvents).toEqual(['Reagendada para qui, 03/dez, 19:00. (em dezembro)']);
    });

    it('emite failed quando o serviço de reagendamento lança erro', async () => {
      rescheduleImpl = async () => {
        throw new Error('Escolha uma data/hora diferente da atual.');
      };
      const fixture = mount(
        makeSession({
          id: 's-orig',
          startsAt: new Date('2026-11-26T22:00:00.000Z'),
        }),
      );
      const root = fixture.nativeElement as HTMLElement;

      buttonByText(root, 'Reagendar')?.click();
      fixture.detectChanges();

      buttonByText(root, 'Reagendar')?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(failedEvents).toEqual(['Escolha uma data/hora diferente da atual.']);
      expect(doneEvents).toEqual([]);
      expect(fixture.componentInstance.mode()).toBe('reschedule');
    });
  });
});
