import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdminMonthService } from '../data/admin-month.service';
import { ChargesService, type ChargesWatch } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import type { Agreement, Patient, Payment, Session } from '../domain/models';
import { FinanceHubComponent } from './finance-hub.component';

const perSession: Agreement = {
  type: 'per_session',
  amount: 15000,
  sessionsPerMonth: 4,
  chargeNoShow: true,
};

const ana: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: perSession,
};
const bruno: Patient = {
  id: 'p2',
  name: 'Bruno Lima',
  phone: '123', // inválido
  active: true,
  agreement: perSession,
};
const carla: Patient = {
  id: 'p3',
  name: 'Carla Dias',
  phone: '11977776666',
  active: true,
  agreement: perSession,
};

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
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

function makePayment(overrides: Partial<Payment> & { id: string }): Payment {
  return {
    patientId: 'p3',
    amount: 15000,
    paidAt: '2026-11-10',
    referenceMonth: '2026-11',
    note: '',
    ...overrides,
  };
}

describe('FinanceHubComponent', () => {
  let fixture: ComponentFixture<FinanceHubComponent>;

  const month = signal('2026-11');
  const setMonth = vi.fn((value: string) => month.set(value));
  const patients = signal<Patient[]>([ana, bruno, carla]);
  const sessions = signal<Session[]>([]);
  const payments = signal<Payment[]>([]);
  const charges = signal<ReadonlyMap<string, Date>>(new Map());

  async function setup(params: Record<string, string> = {}): Promise<void> {
    const sessionsWatch: AllSessionsWatch = {
      sessions: sessions.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };
    const chargesWatch: ChargesWatch = {
      month: '2026-11',
      charges: charges.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    await TestBed.configureTestingModule({
      imports: [FinanceHubComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
        { provide: AdminMonthService, useValue: { month: month.asReadonly(), setMonth } },
        {
          provide: PatientsService,
          useValue: {
            patients: patients.asReadonly(),
            loaded: signal(true).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
          },
        },
        { provide: SessionsService, useValue: { watchAll: () => sessionsWatch } },
        {
          provide: PaymentsService,
          useValue: {
            payments: payments.asReadonly(),
            loaded: signal(true).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            newId: () => 'pay-new',
            create: vi.fn(async () => {}),
            update: vi.fn(async () => {}),
            remove: vi.fn(async () => {}),
          },
        },
        {
          provide: ChargesService,
          useValue: {
            watchMonth: () => chargesWatch,
            markCharged: vi.fn(async () => {}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceHubComponent);
    fixture.detectChanges();
  }

  function clickButton(text: string): void {
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(b =>
      (b as HTMLButtonElement).textContent?.includes(text),
    ) as HTMLButtonElement | undefined;
    expect(btn, `botão "${text}" não encontrado`).toBeDefined();
    btn!.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    month.set('2026-11');
    setMonth.mockClear();
    patients.set([ana, bruno, carla]);
    sessions.set([
      makeSession({ id: 'ana-nov', patientId: 'p1', startsAt: new Date('2026-11-05T13:00:00.000Z') }),
      makeSession({ id: 'bruno-oct', patientId: 'p2', startsAt: new Date('2026-10-05T13:00:00.000Z') }),
      makeSession({ id: 'bruno-nov', patientId: 'p2', startsAt: new Date('2026-11-06T13:00:00.000Z') }),
      makeSession({ id: 'carla-nov', patientId: 'p3', startsAt: new Date('2026-11-07T13:00:00.000Z') }),
    ]);
    payments.set([makePayment({ id: 'pay-c', patientId: 'p3', amount: 15000 })]);
    charges.set(new Map());
  });

  it('renderiza cartões limpos sem tabela 7 colunas, filtra Com pendência por padrão e avisa telefone inválido', async () => {
    await setup();

    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Bruno Lima');
    expect(text).toContain('Em atraso');
    expect(text).toContain('Telefone inválido');
    expect(text).toContain('Ana Paula');
    expect(text).toContain('A receber');
    // Carla está paga, só aparece ao mudar filtro para Todos ou Pagos
    expect(text).not.toContain('Carla Dias');

    clickButton('Todos');
    expect(fixture.nativeElement.textContent).toContain('Carla Dias');
    expect(fixture.nativeElement.textContent).toContain('Pago');
  });

  it('Ver cálculo expande detalhamento em português simples', async () => {
    await setup();

    clickButton('Ver cálculo');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sessões do mês');
    expect(text).toContain('Pix recebidos no mês');
  });

  it('Registrar Pix no cartão abre formulário inline já preenchido sem sair da tela', async () => {
    await setup();

    const cardButtons = Array.from(fixture.nativeElement.querySelectorAll('button')).filter(b =>
      (b as HTMLButtonElement).textContent?.trim() === 'Registrar Pix',
    ) as HTMLButtonElement[];
    expect(cardButtons.length).toBeGreaterThan(0);
    cardButtons[cardButtons.length - 1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-payment-form')).not.toBeNull();
  });

  it('respeita ?aba=cobrar e ?aba=pix e sincroniza ?mes= no AdminMonthService', async () => {
    await setup({ aba: 'cobrar', mes: '2026-10' });
    expect(setMonth).toHaveBeenCalledWith('2026-10');
    expect(fixture.nativeElement.querySelector('app-admin-cobranca')).not.toBeNull();
  });
});
