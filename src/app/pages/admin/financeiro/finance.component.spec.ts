import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';

import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import { chargeMessage } from '../domain/charge-message';
import type { Agreement, Patient, Payment, Session } from '../domain/models';
import { formatCents } from '../domain/money';
import { FinanceComponent } from './finance.component';

const perSession: Agreement = {
  type: 'per_session',
  amount: 15000,
  sessionsPerMonth: 4,
  chargeNoShow: true,
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

/** Ana: sessão em outubro sem Pix (atraso) e duas em novembro com um Pix parcial; Bruno: pacote; paciente removido: só Pix. */
function scenarioSessions(): Session[] {
  return [
    makeSession({ id: 'ana-oct', startsAt: new Date('2026-10-08T13:00:00.000Z') }),
    makeSession({ id: 'ana-nov-1', startsAt: new Date('2026-11-05T13:00:00.000Z') }),
    makeSession({ id: 'ana-nov-2', startsAt: new Date('2026-11-12T13:00:00.000Z') }),
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
  return [
    makePayment({ id: 'pix-ana', patientId: 'p1', amount: 15000 }),
    makePayment({ id: 'pix-gone', patientId: 'gone', amount: 20000 }),
  ];
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const money = (cents: number) => normalize(formatCents(cents));

describe('FinanceComponent', () => {
  let sessionsSignal = signal<Session[]>([]);
  let sessionsLoaded = signal(true);
  let sessionsError = signal<string | null>(null);
  let patientsSignal = signal<Patient[]>([]);
  let paymentsSignal = signal<Payment[]>([]);

  beforeEach(() => {
    sessionsSignal = signal(scenarioSessions());
    sessionsLoaded = signal(true);
    sessionsError = signal<string | null>(null);
    patientsSignal = signal<Patient[]>([ana, bruno]);
    paymentsSignal = signal(scenarioPayments());

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
      imports: [FinanceComponent],
      providers: [
        provideRouter([]),
        { provide: SessionsService, useValue: fakeSessions },
        { provide: PatientsService, useValue: fakePatients },
        { provide: PaymentsService, useValue: fakePayments },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function rootOf(fixture: ComponentFixture<FinanceComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textOf(fixture: ComponentFixture<FinanceComponent>): string {
    return normalize(rootOf(fixture).textContent ?? '');
  }

  function openMonth(month: string): ComponentFixture<FinanceComponent> {
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.componentInstance.setMonth(month);
    fixture.detectChanges();
    return fixture;
  }

  function cardValue(fixture: ComponentFixture<FinanceComponent>, label: string): string {
    const term = Array.from(rootOf(fixture).querySelectorAll('dt')).find(
      dt => normalize(dt.textContent ?? '') === label,
    );
    if (!term) throw new Error(`Cartão "${label}" não encontrado`);
    return normalize(term.nextElementSibling?.textContent ?? '');
  }

  function rowOf(fixture: ComponentFixture<FinanceComponent>, name: string): HTMLTableRowElement {
    const row = Array.from(rootOf(fixture).querySelectorAll<HTMLTableRowElement>('tbody > tr')).find(
      tr => normalize(tr.querySelector('th')?.textContent ?? '') === name,
    );
    if (!row) throw new Error(`Linha "${name}" não encontrada`);
    return row;
  }

  /** Seis colunas de valor, na ordem: devido, recebido, abatido, a receber, em atraso, crédito. */
  function rowCells(fixture: ComponentFixture<FinanceComponent>, name: string): string[] {
    return Array.from(rowOf(fixture, name).querySelectorAll('td'))
      .slice(0, 6)
      .map(cell => normalize(cell.textContent ?? ''));
  }

  function totalCells(fixture: ComponentFixture<FinanceComponent>): string[] {
    return Array.from(rootOf(fixture).querySelectorAll('tfoot td'))
      .slice(0, 6)
      .map(cell => normalize(cell.textContent ?? ''));
  }

  function pixLinkOf(fixture: ComponentFixture<FinanceComponent>, name: string): URL | null {
    const link = Array.from(rowOf(fixture, name).querySelectorAll('a')).find(
      a => normalize(a.textContent ?? '') === 'Registrar Pix',
    );
    return link ? new URL(link.getAttribute('href') ?? '', 'http://localhost') : null;
  }

  function whatsappLinkOf(
    fixture: ComponentFixture<FinanceComponent>,
    name: string,
  ): HTMLAnchorElement | null {
    return (
      Array.from(rowOf(fixture, name).querySelectorAll('a')).find(
        a => normalize(a.textContent ?? '') === 'Cobrar no WhatsApp',
      ) ?? null
    );
  }

  function buttonWithText(
    fixture: ComponentFixture<FinanceComponent>,
    text: string,
  ): HTMLButtonElement {
    const button = Array.from(rootOf(fixture).querySelectorAll('button')).find(
      b => normalize(b.textContent ?? '') === text,
    );
    if (!button) throw new Error(`Botão "${text}" não encontrado`);
    return button;
  }

  it('mostra os cartões e a tabela do mês com os valores exatos', () => {
    const fixture = openMonth('2026-11');

    expect(cardValue(fixture, 'Recebido')).toBe(money(35000));
    expect(cardValue(fixture, 'A receber')).toBe(money(75000));
    expect(cardValue(fixture, 'Em atraso')).toBe(money(15000));

    expect(rowCells(fixture, 'Ana Paula')).toEqual([
      money(30000),
      money(15000),
      money(0),
      money(15000),
      money(15000),
      money(0),
    ]);
    expect(rowCells(fixture, 'Bruno Lima')).toEqual([
      money(60000),
      money(0),
      money(0),
      money(60000),
      money(0),
      money(0),
    ]);
    expect(rowCells(fixture, 'Paciente removido')).toEqual([
      money(0),
      money(20000),
      money(0),
      money(0),
      money(0),
      money(20000),
    ]);
  });

  it('o total da tabela bate com os cartões', () => {
    const fixture = openMonth('2026-11');

    const total = totalCells(fixture);
    expect(total).toEqual([
      money(90000),
      money(35000),
      money(0),
      money(75000),
      money(15000),
      money(20000),
    ]);
    expect(total[1]).toBe(cardValue(fixture, 'Recebido'));
    expect(total[3]).toBe(cardValue(fixture, 'A receber'));
    expect(total[4]).toBe(cardValue(fixture, 'Em atraso'));
  });

  it('mostra o aviso quando o mês não tem sessões e não apresenta a cobrança como quitada', () => {
    const fixture = openMonth('2026-12');

    expect(textOf(fixture)).toContain('Sincronize a agenda deste mês para ver o devido.');
    expect(cardValue(fixture, 'A receber')).toBe('—');
  });

  it('sem sessões no mês, só o recebido tem valor: o resto vira traço na linha e no total', () => {
    const fixture = openMonth('2026-12');

    expect(rowCells(fixture, 'Ana Paula')).toEqual(['—', money(0), '—', '—', '—', '—']);
    expect(totalCells(fixture)).toEqual(['—', money(0), '—', '—', '—', '—']);
  });

  it('o botão Registrar Pix leva paciente, mês e valor a receber, não o em atraso', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({ id: 'ana-nov-3', startsAt: new Date('2026-11-19T13:00:00.000Z') }),
    ]);
    const fixture = openMonth('2026-11');

    expect(rowCells(fixture, 'Ana Paula')[4]).toBe(money(15000));
    const anaLink = pixLinkOf(fixture, 'Ana Paula');
    expect(anaLink?.pathname).toBe('/admin/pagamentos');
    expect(Object.fromEntries(anaLink?.searchParams ?? [])).toEqual({
      paciente: 'p1',
      mes: '2026-11',
      valor: '30000',
    });

    const brunoLink = pixLinkOf(fixture, 'Bruno Lima');
    expect(Object.fromEntries(brunoLink?.searchParams ?? [])).toEqual({
      paciente: 'p2',
      mes: '2026-11',
      valor: '60000',
    });

    expect(pixLinkOf(fixture, 'Paciente removido')).toBeNull();
  });

  it('mostra a nota de sessões sem paciente no singular, sem mudar os valores', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({
        id: 'solta',
        patientId: null,
        startsAt: new Date('2026-11-20T13:00:00.000Z'),
      }),
    ]);
    const fixture = openMonth('2026-11');

    expect(textOf(fixture)).toContain(
      '1 sessão sem paciente neste mês. Vincule-a na tela Sessões para entrar no cálculo.',
    );
    expect(cardValue(fixture, 'A receber')).toBe(money(75000));
  });

  it('mostra a nota de sessões sem paciente no plural', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({
        id: 'solta-1',
        patientId: null,
        startsAt: new Date('2026-11-20T13:00:00.000Z'),
      }),
      makeSession({
        id: 'solta-2',
        patientId: null,
        startsAt: new Date('2026-11-21T13:00:00.000Z'),
      }),
    ]);
    const fixture = openMonth('2026-11');

    expect(textOf(fixture)).toContain(
      '2 sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.',
    );
  });

  it('mês sem movimento nem sessões sem paciente mostra "Nenhum movimento"', () => {
    const fixture = openMonth('2026-09');

    expect(textOf(fixture)).toContain('Nenhum movimento neste mês.');
    expect(rootOf(fixture).querySelector('table')).toBeNull();
  });

  it('quando nenhuma sessão do mês está sem paciente, não mostra a nota', () => {
    const fixture = openMonth('2026-11');

    expect(textOf(fixture)).not.toContain('sem paciente neste mês');
  });

  it('mês só com sessões sem paciente mostra a nota, não "Nenhum movimento"', () => {
    sessionsSignal.set([
      makeSession({
        id: 'solta',
        patientId: null,
        startsAt: new Date('2026-12-03T13:00:00.000Z'),
      }),
    ]);
    const fixture = openMonth('2026-12');

    expect(textOf(fixture)).toContain('1 sessão sem paciente neste mês.');
    expect(textOf(fixture)).not.toContain('Nenhum movimento neste mês.');
    expect(textOf(fixture)).not.toContain('Sincronize a agenda deste mês');
  });

  it('mês só com sessões sem paciente: os valores derivados viram traço, sem aviso de sincronia', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({
        id: 'solta',
        patientId: null,
        startsAt: new Date('2026-12-03T13:00:00.000Z'),
      }),
    ]);
    const fixture = openMonth('2026-12');

    expect(textOf(fixture)).toContain('1 sessão sem paciente neste mês.');
    expect(textOf(fixture)).not.toContain('Sincronize a agenda deste mês');
    expect(cardValue(fixture, 'A receber')).toBe('—');
    expect(cardValue(fixture, 'Em atraso')).toBe('—');
    expect(rowCells(fixture, 'Ana Paula')).toEqual(['—', money(0), '—', '—', '—', '—']);
    expect(totalCells(fixture)).toEqual(['—', money(0), '—', '—', '—', '—']);
  });

  it('mês só com sessões sem paciente e um Pix: só o recebido tem valor, o resto vira traço', () => {
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
    expect(cardValue(fixture, 'Recebido')).toBe(money(50000));
    expect(cardValue(fixture, 'A receber')).toBe('—');
    expect(cardValue(fixture, 'Em atraso')).toBe('—');
    expect(rowCells(fixture, 'Ana Paula')).toEqual(['—', money(50000), '—', '—', '—', '—']);
    expect(rowCells(fixture, 'Bruno Lima')).toEqual(['—', money(0), '—', '—', '—', '—']);
    expect(totalCells(fixture)).toEqual(['—', money(50000), '—', '—', '—', '—']);
  });

  it('mês inválido não troca a tabela', () => {
    const fixture = openMonth('2026-11');

    fixture.componentInstance.setMonth('');
    fixture.detectChanges();

    expect(fixture.componentInstance.month()).toBe('2026-11');
    expect(cardValue(fixture, 'Recebido')).toBe(money(35000));
  });

  it('trocar o mês recalcula a tabela e os cartões', () => {
    const fixture = openMonth('2026-11');

    fixture.componentInstance.setMonth('2026-10');
    fixture.detectChanges();

    expect(rowCells(fixture, 'Ana Paula')).toEqual([
      money(15000),
      money(0),
      money(0),
      money(15000),
      money(0),
      money(0),
    ]);
    expect(textOf(fixture)).not.toContain('Bruno Lima');
    expect(cardValue(fixture, 'Recebido')).toBe(money(0));
    expect(cardValue(fixture, 'A receber')).toBe(money(15000));
  });

  it('a explicação do abatimento cita o mês de origem', () => {
    const extra = makePayment({ id: 'pix-ana-2', patientId: 'p1', amount: 30000 });
    paymentsSignal.update(list => [...list, extra]);
    const fixture = openMonth('2026-10');

    const toggle = buttonWithText(fixture, 'Detalhes');
    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(textOf(fixture)).toContain(`${money(15000)} abatidos com o crédito de 2026-11`);
  });

  it('abre no mês atual em UTC-3: 2026-12-01T02:30Z ainda é novembro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T02:30:00Z'));
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.month()).toBe('2026-11');
  });

  it('mostra carregando enquanto o listener de sessões não respondeu', () => {
    sessionsLoaded.set(false);
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Carregando financeiro...');
    expect(rootOf(fixture).querySelector('table')).toBeNull();
  });

  it('mostra o erro de carregamento das sessões em vez da tabela', () => {
    sessionsError.set('Não foi possível carregar as sessões.');
    const fixture = TestBed.createComponent(FinanceComponent);
    fixture.detectChanges();

    expect(rootOf(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar as sessões.',
    );
    expect(rootOf(fixture).querySelector('table')).toBeNull();
  });

  it('mostra o botão Cobrar no WhatsApp para paciente em atraso com total devido (a receber + atraso)', () => {
    const fixture = openMonth('2026-11');

    const link = whatsappLinkOf(fixture, 'Ana Paula');
    if (!link) throw new Error('Link Cobrar no WhatsApp não encontrado');

    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('href')).toBe(
      `https://wa.me/5511999999999?text=${encodeURIComponent(chargeMessage('Ana Paula', 30000))}`,
    );
  });

  it('não mostra Cobrar no WhatsApp nem aviso quando o paciente não está em atraso', () => {
    const fixture = openMonth('2026-11');
    expect(whatsappLinkOf(fixture, 'Bruno Lima')).toBeNull();
    expect(normalize(rowOf(fixture, 'Bruno Lima').textContent ?? '')).not.toContain(
      'Telefone inválido para WhatsApp',
    );

    const octFixture = openMonth('2026-10');
    expect(whatsappLinkOf(octFixture, 'Ana Paula')).toBeNull();
    expect(normalize(rowOf(octFixture, 'Ana Paula').textContent ?? '')).not.toContain(
      'Telefone inválido para WhatsApp',
    );
  });

  it('mostra aviso na linha em vez do botão quando paciente em atraso tem telefone inválido', () => {
    patientsSignal.set([{ ...ana, phone: '123' }, bruno]);
    const fixture = openMonth('2026-11');

    expect(whatsappLinkOf(fixture, 'Ana Paula')).toBeNull();
    expect(normalize(rowOf(fixture, 'Ana Paula').textContent ?? '')).toContain(
      'Telefone inválido para WhatsApp. Corrija em Pacientes.',
    );
  });

  it('não mostra botão nem aviso de cobrança em mês sem sessões vinculadas', () => {
    patientsSignal.set([{ ...ana, phone: '123' }, bruno]);
    const fixture = openMonth('2026-12');

    expect(whatsappLinkOf(fixture, 'Ana Paula')).toBeNull();
    expect(whatsappLinkOf(fixture, 'Bruno Lima')).toBeNull();
    expect(textOf(fixture)).not.toContain('Cobrar no WhatsApp');
    expect(textOf(fixture)).not.toContain('Telefone inválido para WhatsApp');
  });

  it('não mostra botão nem aviso para paciente removido em atraso', () => {
    sessionsSignal.update(list => [
      ...list,
      makeSession({
        id: 'gone-oct',
        patientId: 'gone',
        amountApplied: 25000,
        startsAt: new Date('2026-10-10T13:00:00.000Z'),
      }),
    ]);
    const fixture = openMonth('2026-11');

    expect(rowCells(fixture, 'Paciente removido')[4]).toBe(money(5000));
    expect(whatsappLinkOf(fixture, 'Paciente removido')).toBeNull();
    expect(normalize(rowOf(fixture, 'Paciente removido').textContent ?? '')).not.toContain(
      'Telefone inválido para WhatsApp',
    );
  });

  it('exibe legenda explicando Abatido e Crédito abaixo da tabela', () => {
    const fixture = openMonth('2026-11');

    expect(textOf(fixture)).toContain(
      'Abatido: valor deste mês coberto por crédito de outro mês. Crédito: sobra deste mês após abater atrasos anteriores.',
    );
  });
});
