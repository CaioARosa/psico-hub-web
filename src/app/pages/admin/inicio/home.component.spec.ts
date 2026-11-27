import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdminMonthService } from '../data/admin-month.service';
import { AutoSyncService } from '../data/auto-sync.service';
import { ChargesService, type ChargesWatch } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import type { DashboardPoint } from '../domain/dashboard';
import type { Agreement, Patient, Payment, Session } from '../domain/models';
import { RevenueChartComponent } from '../painel/revenue-chart.component';
import { HomeComponent } from './home.component';

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class StubChartComponent {
  readonly series = input<DashboardPoint[]>();
}

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

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
    calendarTitle: 'Consulta - Ana Paula',
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
    patientId: 'p1',
    amount: 15000,
    paidAt: '2026-11-10',
    referenceMonth: '2026-11',
    note: '',
    ...overrides,
  };
}

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  const month = signal('2026-11');
  const setMonth = vi.fn((value: string) => month.set(value));
  const patients = signal<Patient[]>([ana]);
  const sessions = signal<Session[]>([]);
  const payments = signal<Payment[]>([]);
  const charges = signal<ReadonlyMap<string, Date>>(new Map());
  const syncing = signal(false);
  const lastSyncedAt = signal<Date | null>(new Date('2026-11-20T12:00:00.000Z'));

  async function setup(queryMes?: string): Promise<void> {
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
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryMes ? { mes: queryMes } : {}) } },
        },
        { provide: AdminMonthService, useValue: { month: month.asReadonly(), setMonth } },
        { provide: AutoSyncService, useValue: { syncing: syncing.asReadonly(), lastSyncedAt: lastSyncedAt.asReadonly() } },
        { provide: PatientsService, useValue: { patients: patients.asReadonly(), loaded: signal(true).asReadonly(), error: signal<string | null>(null).asReadonly() } },
        { provide: SessionsService, useValue: { watchAll: () => sessionsWatch } },
        { provide: PaymentsService, useValue: { payments: payments.asReadonly(), loaded: signal(true).asReadonly(), error: signal<string | null>(null).asReadonly() } },
        { provide: ChargesService, useValue: { watchMonth: () => chargesWatch } },
      ],
    })
      .overrideComponent(HomeComponent, {
        remove: { imports: [RevenueChartComponent] },
        add: { imports: [StubChartComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    month.set('2026-11');
    setMonth.mockClear();
    patients.set([ana]);
    sessions.set([]);
    payments.set([]);
    charges.set(new Map());
    syncing.set(false);
    lastSyncedAt.set(new Date('2026-11-20T12:00:00.000Z'));
  });

  it('sincroniza AdminMonthService quando chega com ?mes= válido', async () => {
    await setup('2026-10');
    expect(setMonth).toHaveBeenCalledWith('2026-10');
  });

  it('mostra Trilha de Sucesso com CTA do próximo passo quando há pendências', async () => {
    sessions.set([makeSession({ id: 's-unlinked', patientId: null, status: 'scheduled' })]);
    await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Próximo passo');
    expect(text).toContain('Resolver 1 pendência');
    expect(text).toContain('Recebido');
    expect(text).toContain('A receber');
    expect(text).toContain('Em atraso');
    expect(text).toContain('Sessões');
  });

  it('recolhe a trilha no selo tranquilo Tudo em dia quando allClear é true', async () => {
    sessions.set([makeSession({ id: 's1', status: 'done' })]);
    payments.set([makePayment({ id: 'pay1', amount: 15000 })]);
    await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Tudo em dia');
  });

  it('mostra estado neutro enquanto sincroniza e nunca pede para clicar em sincronizar', async () => {
    syncing.set(true);
    lastSyncedAt.set(null);
    await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Buscando sessões no Google Agenda');
    expect(text).not.toContain('Sincronize a agenda deste mês para ver o devido');
  });
});
