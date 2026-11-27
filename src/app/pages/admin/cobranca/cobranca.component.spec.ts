import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ChargesService, type ChargesWatch } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import { chargeMessage, whatsappLink } from '../domain/charge-message';
import type { Patient, Payment, Session } from '../domain/models';
import { formatCents } from '../domain/money';
import { CobrancaComponent } from './cobranca.component';

function patient(id: string, name: string, phone = '11988887777'): Patient {
  return {
    id,
    name,
    phone,
    active: true,
    agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: false },
  };
}

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-10-08T13:00:00.000Z'),
    calendarTitle: 'Consulta',
    status: 'done',
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

/** Em nov/2026: Ana deve 15000 de outubro, Carla deve 20000 de outubro e Bruno (pacote) só tem a receber, sem atraso. */
const scenarioSessions = (): Session[] => [
  session({ id: 'ana-oct', patientId: 'p1' }),
  session({ id: 'carla-oct', patientId: 'p3', amountApplied: 20000, startsAt: new Date('2026-10-09T13:00:00.000Z') }),
  session({
    id: 'bruno-nov',
    patientId: 'p2',
    amountApplied: 0,
    packageAmountApplied: 60000,
    startsAt: new Date('2026-11-06T13:00:00.000Z'),
  }),
];

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('CobrancaComponent', () => {
  let chargesSignal = signal<ReadonlyMap<string, Date>>(new Map());
  let patientsSignal = signal<Patient[]>([]);
  let markCharged: ReturnType<typeof vi.fn<(patientId: string, month: string, amount: number) => Promise<void>>>;

  beforeEach(() => {
    chargesSignal = signal<ReadonlyMap<string, Date>>(new Map());
    patientsSignal = signal([patient('p1', 'Ana Paula'), patient('p2', 'Bruno Lima'), patient('p3', 'Carla Dias')]);
    markCharged = vi.fn(async (patientId: string) => {
      chargesSignal.update(current => new Map(current).set(patientId, new Date()));
    });

    const sessions = signal(scenarioSessions());
    TestBed.configureTestingModule({
      imports: [CobrancaComponent],
      providers: [
        provideRouter([]),
        {
          provide: SessionsService,
          useValue: {
            watchAll: (): AllSessionsWatch => ({
              sessions: sessions.asReadonly(),
              loaded: signal(true).asReadonly(),
              error: signal<string | null>(null).asReadonly(),
            }),
          },
        },
        {
          provide: PatientsService,
          useValue: {
            patients: patientsSignal.asReadonly(),
            loaded: signal(true).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            payments: signal<Payment[]>([]).asReadonly(),
            loaded: signal(true).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
          },
        },
        {
          provide: ChargesService,
          useValue: {
            watchMonth: (month: string): ChargesWatch => ({
              month,
              charges: chargesSignal.asReadonly(),
              loaded: signal(true).asReadonly(),
              error: signal<string | null>(null).asReadonly(),
            }),
            markCharged,
          },
        },
      ],
    });
  });

  function open(): ComponentFixture<CobrancaComponent> {
    const fixture = TestBed.createComponent(CobrancaComponent);
    fixture.componentInstance.setMonth('2026-11');
    fixture.detectChanges();
    return fixture;
  }

  const textOf = (fixture: ComponentFixture<CobrancaComponent>) =>
    normalize((fixture.nativeElement as HTMLElement).textContent ?? '');

  const buttonByText = (fixture: ComponentFixture<CobrancaComponent>, text: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      b => normalize(b.textContent ?? '') === text,
    );

  it('mostra a primeira paciente em atraso com a mensagem pronta no campo de texto', () => {
    const fixture = open();

    expect(textOf(fixture)).toContain('Carla Dias');
    expect(textOf(fixture)).toContain(normalize(formatCents(20000)));
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea');
    expect(textarea?.value).toBe(chargeMessage('Carla Dias', 20000));
    expect(textOf(fixture)).not.toContain('Bruno Lima');
  });

  it('Abrir WhatsApp aponta para wa.me com o texto editado', () => {
    const fixture = open();
    const item = fixture.componentInstance.current()!;

    fixture.componentInstance.setDraft(item.patientId, 'Oi, Carla! Tudo bem?');
    fixture.detectChanges();

    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find(a =>
      normalize(a.textContent ?? '').startsWith('Abrir WhatsApp'),
    );
    expect(link?.getAttribute('href')).toBe(whatsappLink('11988887777', 'Oi, Carla! Tudo bem?'));
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('só pergunta "Enviou a mensagem?" depois de abrir o WhatsApp', () => {
    const fixture = open();
    expect(textOf(fixture)).not.toContain('Enviou a mensagem?');

    fixture.componentInstance.onOpened(fixture.componentInstance.current()!);
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Enviou a mensagem?');
  });

  it('Sim, marcar como cobrada grava uma vez com o total e avança para a próxima', async () => {
    const fixture = open();
    fixture.componentInstance.onOpened(fixture.componentInstance.current()!);
    fixture.detectChanges();

    buttonByText(fixture, 'Sim, marcar como cobrada')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(markCharged).toHaveBeenCalledTimes(1);
    expect(markCharged).toHaveBeenCalledWith('p3', '2026-11', 20000);
    expect(textOf(fixture)).toContain('Ana Paula');
    expect(textOf(fixture)).not.toContain('Enviou a mensagem?');
  });

  it('clique duplo em marcar grava uma única vez', async () => {
    let finish!: () => void;
    markCharged.mockImplementation(() => new Promise<void>(resolve => (finish = resolve)));
    const fixture = open();
    const item = fixture.componentInstance.current()!;
    fixture.componentInstance.onOpened(item);

    const first = fixture.componentInstance.confirmCharged(item);
    const second = fixture.componentInstance.confirmCharged(item);
    finish();
    await Promise.all([first, second]);

    expect(markCharged).toHaveBeenCalledTimes(1);
  });

  it('falha ao gravar mostra o erro, mantém a paciente e permite tentar de novo', async () => {
    markCharged.mockRejectedValueOnce(new Error('Não foi possível confirmar o salvamento.'));
    const fixture = open();
    const item = fixture.componentInstance.current()!;
    fixture.componentInstance.onOpened(item);

    await fixture.componentInstance.confirmCharged(item);
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Não foi possível confirmar o salvamento.');
    expect(fixture.componentInstance.current()?.patientId).toBe('p3');
    expect(buttonByText(fixture, 'Sim, marcar como cobrada')).toBeDefined();

    await fixture.componentInstance.confirmCharged(item);
    expect(markCharged).toHaveBeenCalledTimes(2);
  });

  it('Pular tira a paciente do passo a passo sem gravar', () => {
    const fixture = open();

    fixture.componentInstance.skip(fixture.componentInstance.current()!);
    fixture.detectChanges();

    expect(markCharged).not.toHaveBeenCalled();
    expect(fixture.componentInstance.current()?.patientId).toBe('p1');
  });

  it('sem pendentes mostra "Fila concluída" e lista as cobradas há menos de 7 dias', () => {
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);
    chargesSignal.set(new Map([['p1', recent], ['p3', recent]]));

    const fixture = open();

    expect(textOf(fixture)).toContain('Fila concluída');
    expect(textOf(fixture)).toContain('Cobradas há menos de 7 dias');
    expect(textOf(fixture)).toContain('Ana Paula');
    expect(textOf(fixture)).toContain('Carla Dias');
  });

  it('telefone inválido aparece com a nota para corrigir em Pacientes', () => {
    patientsSignal.set([patient('p1', 'Ana Paula', '1234'), patient('p2', 'Bruno Lima'), patient('p3', 'Carla Dias')]);

    const fixture = open();

    expect(textOf(fixture)).toContain('Ana Paula');
    expect(textOf(fixture)).toContain('Corrija em Pacientes');
  });

  it('em modo embedded oculta cabeçalho próprio e acompanha o mês passado via input', () => {
    const fixture = TestBed.createComponent(CobrancaComponent);
    fixture.componentRef.setInput('embedded', true);
    fixture.componentRef.setInput('externalMonth', '2026-10');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
    expect(fixture.componentInstance.activeMonth()).toBe('2026-10');
  });
});
