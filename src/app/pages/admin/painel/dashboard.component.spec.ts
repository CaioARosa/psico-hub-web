import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';

import { CalendarSyncsService, type SyncWatch } from '../data/calendar-syncs.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import type { DashboardPoint } from '../domain/dashboard';
import { buildLedger, summarizeMonth } from '../domain/finance';
import type { Agreement, Patient, Payment, Session } from '../domain/models';
import { formatCents } from '../domain/money';
import { DashboardComponent } from './dashboard.component';
import { RevenueChartComponent } from './revenue-chart.component';

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
  chargeNoShow: false,
};
const monthly: Agreement = {
  type: 'monthly_package',
  amount: 60000,
  sessionsPerMonth: 4,
  chargeNoShow: false,
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
  phone: '11988888888',
  active: true,
  agreement: monthly,
};

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-05T13:00:00.000Z'),
    calendarTitle: 'Consulta [Individual] - Ana Paula',
    status: 'done',
    amountApplied: 15000,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
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

/** Novembro: Ana com 2 realizadas e 1 agendada, Bruno com 1 realizada (pacote); Pix parcial de Ana. */
function scenarioSessions(): Session[] {
  return [
    makeSession({ id: 'ana-nov-1', startsAt: new Date('2026-11-05T13:00:00.000Z') }),
    makeSession({ id: 'ana-nov-2', startsAt: new Date('2026-11-12T13:00:00.000Z') }),
    makeSession({
      id: 'ana-nov-3',
      startsAt: new Date('2026-11-26T13:00:00.000Z'),
      status: 'scheduled',
      amountApplied: 0,
    }),
    makeSession({
      id: 'bruno-nov',
      patientId: 'p2',
      amountApplied: 0,
      packageAmountApplied: 60000,
      startsAt: new Date('2026-11-06T13:00:00.000Z'),
    }),
  ];
}

function scenarioPayments(): Payment[] {
  return [makePayment({ id: 'pix-ana', patientId: 'p1', amount: 15000 })];
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const money = (cents: number) => normalize(formatCents(cents));

describe('DashboardComponent', () => {
  let sessionsSignal = signal<Session[]>([]);
  let sessionsLoaded = signal(true);
  let sessionsError = signal<string | null>(null);
  let patientsSignal = signal<Patient[]>([]);
  let paymentsSignal = signal<Payment[]>([]);
  let lastSyncedAt = signal<Date | null>(null);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));

    sessionsSignal = signal(scenarioSessions());
    sessionsLoaded = signal(true);
    sessionsError = signal<string | null>(null);
    patientsSignal = signal<Patient[]>([ana, bruno]);
    paymentsSignal = signal(scenarioPayments());
    lastSyncedAt = signal<Date | null>(new Date('2026-11-17T12:00:00Z'));

    const fakeSyncs: Pick<CalendarSyncsService, 'watchMonth'> = {
      watchMonth: (month: string): SyncWatch => ({ month, lastSyncedAt: lastSyncedAt.asReadonly() }),
    };

    const fakeSessions: Pick<SessionsService, 'watchAll'> = {
      watchAll: (): AllSessionsWatch => ({
        sessions: sessionsSignal.asReadonly(),
        loaded: sessionsLoaded.asReadonly(),
        error: sessionsError.asReadonly(),
      }),
    };

    const fakePatients: Pick<PatientsService, 'patients' | 'loaded' | 'error'> = {
      patients: patientsSignal.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    const fakePayments: Pick<PaymentsService, 'payments' | 'loaded' | 'error'> = {
      payments: paymentsSignal.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsService, useValue: fakeSessions },
        { provide: PatientsService, useValue: fakePatients },
        { provide: PaymentsService, useValue: fakePayments },
        { provide: CalendarSyncsService, useValue: fakeSyncs },
      ],
    });
    TestBed.overrideComponent(DashboardComponent, {
      remove: { imports: [RevenueChartComponent] },
      add: { imports: [StubChartComponent] },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function rootOf(fixture: ComponentFixture<DashboardComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textOf(fixture: ComponentFixture<DashboardComponent>): string {
    return normalize(rootOf(fixture).textContent ?? '');
  }

  function openMonth(month: string): ComponentFixture<DashboardComponent> {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.setMonth(month);
    fixture.detectChanges();
    return fixture;
  }

  function cardValue(fixture: ComponentFixture<DashboardComponent>, label: string): string {
    const term = Array.from(rootOf(fixture).querySelectorAll('dt')).find(
      dt => normalize(dt.textContent ?? '') === label,
    );
    if (!term) throw new Error(`Cartão "${label}" não encontrado`);
    return normalize(term.nextElementSibling?.textContent ?? '');
  }

  function forecastBlock(fixture: ComponentFixture<DashboardComponent>): HTMLElement {
    const block = rootOf(fixture).querySelector<HTMLElement>('[aria-labelledby="forecast-title"]');
    if (!block) throw new Error('Bloco "Previsto × Realizado" não encontrado');
    return block;
  }

  function alertsText(fixture: ComponentFixture<DashboardComponent>): string {
    return normalize(rootOf(fixture).querySelector('[aria-labelledby="alerts-title"]')?.textContent ?? '');
  }

  it('mês atual sincronizado há pouco mostra a hora da sincronização, sem destaque', () => {
    const fixture = openMonth('2026-11');

    expect(alertsText(fixture)).toContain('Agendadas contadas até a sincronização de 17/11/2026');
    expect(alertsText(fixture)).not.toContain('Ir para Sessões');
  });

  it('mês atual com sincronização antiga avisa e leva para Sessões', () => {
    lastSyncedAt.set(new Date('2026-11-10T12:00:00Z'));
    const fixture = openMonth('2026-11');

    expect(alertsText(fixture)).toContain('sincronizada há 7 dias');
    expect(alertsText(fixture)).toContain('Ir para Sessões');
  });

  it('mês atual sem registro de sincronização pede para sincronizar', () => {
    lastSyncedAt.set(null);
    const fixture = openMonth('2026-11');

    expect(alertsText(fixture)).toContain('Não há registro de sincronização deste mês');
  });

  it('mês passado não mostra aviso de sincronização', () => {
    lastSyncedAt.set(null);
    const fixture = openMonth('2026-10');

    expect(alertsText(fixture)).not.toContain('sincroniza');
  });

  it('mostra os cartões com os valores exatos', () => {
    const fixture = openMonth('2026-11');

    expect(cardValue(fixture, 'Pacientes atendidos')).toBe('2');
    expect(cardValue(fixture, 'Realizadas')).toBe('3');
    expect(cardValue(fixture, 'Faltas')).toBe('0');
    expect(cardValue(fixture, 'Cancelamentos')).toBe('0');
    expect(cardValue(fixture, 'Recebido')).toBe(money(15000));
    expect(cardValue(fixture, 'Devido')).toBe(money(90000));
    expect(cardValue(fixture, 'Previsto (acordos atuais)')).toBe(money(120000));
  });

  it('Recebido e Devido batem com o Financeiro', () => {
    const fixture = openMonth('2026-11');
    const { totals } = summarizeMonth(
      buildLedger({
        patients: patientsSignal(),
        sessions: sessionsSignal(),
        payments: paymentsSignal(),
      }),
      '2026-11',
    );

    expect(cardValue(fixture, 'Recebido')).toBe(money(totals.received));
    expect(cardValue(fixture, 'Devido')).toBe(money(totals.due));
  });

  it('mostra o previsto × realizado', () => {
    const fixture = openMonth('2026-11');
    const block = normalize(forecastBlock(fixture).textContent ?? '');

    expect(block).toContain('Previsto × Realizado');
    expect(block).toContain(money(90000));
    expect(block).toContain(money(120000));
    expect(forecastBlock(fixture).querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('lista os alertas com a contagem do mês corrente', () => {
    const fixture = openMonth('2026-11');
    const text = alertsText(fixture);

    expect(text).toContain('Ana Paula: contratado 4, previstas 3 (falta 1)');
    expect(text).toContain('Bruno Lima: contratado 4, previstas 1 (falta 3)');
  });

  it('mês passado usa "realizadas"', () => {
    sessionsSignal.set(
      [1, 8, 15].map(day =>
        makeSession({
          id: `ana-oct-${day}`,
          startsAt: new Date(`2026-10-${String(day).padStart(2, '0')}T13:00:00.000Z`),
        }),
      ),
    );
    const fixture = openMonth('2026-10');

    expect(alertsText(fixture)).toContain('Ana Paula: contratado 4, realizadas 3 (falta 1)');
  });

  it('sem alertas mostra o estado vazio', () => {
    sessionsSignal.set([
      ...scenarioSessions(),
      makeSession({
        id: 'ana-nov-4',
        startsAt: new Date('2026-11-27T13:00:00.000Z'),
        status: 'scheduled',
        amountApplied: 0,
      }),
      ...[13, 20, 27].map(day =>
        makeSession({
          id: `bruno-nov-${day}`,
          patientId: 'p2',
          amountApplied: 0,
          status: 'scheduled',
          startsAt: new Date(`2026-11-${day}T13:00:00.000Z`),
        }),
      ),
    ]);
    const fixture = openMonth('2026-11');

    expect(textOf(fixture)).toContain('Nenhum alerta de frequência neste mês');
    expect(rootOf(fixture).querySelector('[aria-labelledby="alerts-title"] li')).toBeNull();
  });

  it('mês sem sessões não lista alertas e explica que não há frequência para avaliar', () => {
    const fixture = openMonth('2026-12');

    expect(alertsText(fixture)).toContain(
      'Sem sessões vinculadas neste mês para avaliar a frequência.',
    );
    expect(textOf(fixture)).not.toContain('Nenhum alerta de frequência neste mês');
    expect(rootOf(fixture).querySelector('[aria-labelledby="alerts-title"] li')).toBeNull();
  });

  it('mês só com sessão sem paciente também não avalia frequência', () => {
    sessionsSignal.set([
      makeSession({
        id: 'solta',
        patientId: null,
        startsAt: new Date('2026-12-03T13:00:00.000Z'),
      }),
    ]);
    const fixture = openMonth('2026-12');

    expect(alertsText(fixture)).toContain(
      'Sem sessões vinculadas neste mês para avaliar a frequência.',
    );
    expect(rootOf(fixture).querySelector('[aria-labelledby="alerts-title"] li')).toBeNull();
  });

  it('a tabela sr-only repete a série', () => {
    const fixture = openMonth('2026-11');
    const table = rootOf(fixture).querySelector('table.sr-only');
    if (!table) throw new Error('Tabela da série não encontrada');
    const text = normalize(table.textContent ?? '');

    expect(text).toContain('Recebido e devido nos últimos 6 meses');
    expect(text).toContain('nov/26');
    expect(text).toContain('out/26');
    expect(text).toContain(money(15000));
    expect(table.querySelectorAll('tbody tr')).toHaveLength(6);

    const chart = fixture.debugElement.query(By.directive(StubChartComponent));
    expect(chart.componentInstance.series()).toHaveLength(6);
  });

  it('mês sem sessões mostra o aviso e não apresenta zero como quitado', () => {
    const fixture = openMonth('2026-12');

    expect(textOf(fixture)).toContain('Sincronize a agenda deste mês para ver o devido.');
    expect(cardValue(fixture, 'Devido')).toBe('—');
  });

  it('mês só com sessão sem paciente: Devido e Realizado viram traço, Recebido continua', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({
        id: 'solta',
        patientId: null,
        startsAt: new Date('2026-12-03T13:00:00.000Z'),
      }),
    ]);
    paymentsSignal.update(list => [
      ...list,
      makePayment({
        id: 'pix-dez',
        patientId: 'p1',
        amount: 50000,
        paidAt: '2026-12-10',
        referenceMonth: '2026-12',
      }),
    ]);
    const fixture = openMonth('2026-12');

    expect(textOf(fixture)).toContain('1 sessão sem paciente neste mês.');
    expect(textOf(fixture)).not.toContain('Sincronize a agenda deste mês');
    expect(cardValue(fixture, 'Devido')).toBe('—');
    expect(cardValue(fixture, 'Recebido')).toBe(money(50000));
    expect(cardValue(fixture, 'Realizado')).toBe('—');
    expect(cardValue(fixture, 'Previsto (acordos atuais)')).toBe(money(120000));
    expect(forecastBlock(fixture).querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('mostra a nota de sessões sem paciente no plural', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({ id: 'solta-1', patientId: null }),
      makeSession({ id: 'solta-2', patientId: null }),
    ]);
    const fixture = openMonth('2026-11');

    expect(textOf(fixture)).toContain(
      '2 sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.',
    );
  });

  it('mês inválido não troca a tela', () => {
    const fixture = openMonth('2026-11');

    fixture.componentInstance.setMonth('');
    fixture.detectChanges();

    expect(fixture.componentInstance.month()).toBe('2026-11');
    expect(cardValue(fixture, 'Recebido')).toBe(money(15000));
  });

  it('trocar o mês recalcula', () => {
    const fixture = openMonth('2026-11');

    fixture.componentInstance.setMonth('2026-10');
    fixture.detectChanges();

    expect(cardValue(fixture, 'Realizadas')).toBe('0');
    expect(textOf(fixture)).toContain('Sincronize a agenda deste mês para ver o devido.');
  });

  it('abre no mês atual em UTC-3: 2026-12-01T02:30Z ainda é novembro', () => {
    vi.setSystemTime(new Date('2026-12-01T02:30:00Z'));
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.month()).toBe('2026-11');
  });

  it('mostra carregando enquanto o listener de sessões não respondeu', () => {
    sessionsLoaded.set(false);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Carregando painel...');
    expect(rootOf(fixture).querySelector('dl')).toBeNull();
  });

  it('mostra o erro de carregamento das sessões em vez dos cartões', () => {
    sessionsError.set('Não foi possível carregar as sessões.');
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(rootOf(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar as sessões.',
    );
    expect(rootOf(fixture).querySelector('dl')).toBeNull();
  });

  it('exibe explicação da regra de contagem nos alertas de frequência', () => {
    const fixture = openMonth('2026-11');

    expect(alertsText(fixture)).toContain(
      'No mês atual e futuros, soma realizadas + agendadas; em meses passados, apenas realizadas.',
    );
  });
});
