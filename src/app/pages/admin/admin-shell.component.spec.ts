import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdminShellComponent } from './admin-shell.component';
import { AdminMonthService } from './data/admin-month.service';
import { AuthService } from './data/auth.service';
import { AutoSyncService, type AutoSyncOutcome } from './data/auto-sync.service';
import { ChargesService, type ChargesWatch } from './data/charges.service';
import { OnboardingService } from './data/onboarding.service';
import { PatientsService } from './data/patients.service';
import { PaymentsService } from './data/payments.service';
import { SessionsService, type AllSessionsWatch } from './data/sessions.service';
import type { Patient, Payment, Session } from './domain/models';

@Component({ standalone: true, template: '<p>stub</p>' })
class StubPage {}

const emptyOutcome: AutoSyncOutcome = {
  synced: [],
  skipped: [],
  totals: { created: 0, updated: 0, unidentified: 0, missing: 0 },
};

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;
  let router: Router;

  const month = signal('2026-11');
  const isCurrentMonth = signal(true);
  const patients = signal<Patient[]>([
    {
      id: 'p1',
      name: 'Ana Paula',
      phone: '11999999999',
      active: true,
      agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: true },
    },
  ]);
  const sessions = signal<Session[]>([
    {
      id: 's1',
      patientId: null,
      startsAt: new Date('2026-11-05T13:00:00.000Z'),
      calendarTitle: 'Consulta - Desconhecido',
      status: 'scheduled',
      amountApplied: 0,
      packageAmountApplied: null,
      chargeNoShowApplied: null,
      missingFromCalendar: false,
      rescheduledToId: null,
      rescheduledToStartsAt: null,
      statusBeforeReschedule: null,
      rescheduledFromId: null,
      rescheduledFromStartsAt: null,
    },
  ]);
  const payments = signal<Payment[]>([]);
  const charges = signal<ReadonlyMap<string, Date>>(new Map());
  const syncing = signal(false);
  const lastSyncedAt = signal<Date | null>(new Date());
  const syncError = signal<string | null>(null);
  const errorNonce = signal(0);

  const runOnEntry = vi.fn(async () => emptyOutcome);
  const reportError = vi.fn((msg: string) => {
    syncError.set(msg);
    errorNonce.update(n => n + 1);
  });
  const clearError = vi.fn(() => syncError.set(null));
  const initForCurrentUser = vi.fn();
  const openManual = vi.fn();
  const syncCurrentMonthForce = vi.fn(async () => emptyOutcome);
  const shift = vi.fn();
  const resetToCurrent = vi.fn();
  const setMonth = vi.fn();

  beforeEach(async () => {
    month.set('2026-11');
    isCurrentMonth.set(true);
    syncError.set(null);
    errorNonce.set(0);
    runOnEntry.mockClear();
    reportError.mockClear();
    clearError.mockClear();
    initForCurrentUser.mockClear();
    openManual.mockClear();
    syncCurrentMonthForce.mockReset().mockResolvedValue(emptyOutcome);
    shift.mockClear();
    resetToCurrent.mockClear();
    setMonth.mockClear();

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
      imports: [AdminShellComponent],
      providers: [
        provideRouter([
          { path: 'admin/inicio', component: StubPage },
          { path: 'admin/atendimentos', component: StubPage },
          { path: 'admin/financeiro', component: StubPage },
          { path: 'admin/pacientes', component: StubPage },
        ]),
        { provide: AuthService, useValue: { user: signal({ uid: 'u1' }).asReadonly(), logout: vi.fn(async () => {}) } },
        {
          provide: AutoSyncService,
          useValue: {
            runOnEntry,
            syncing: syncing.asReadonly(),
            lastSyncedAt: lastSyncedAt.asReadonly(),
            error: syncError.asReadonly(),
            errorNonce: errorNonce.asReadonly(),
            clearError,
            reportError,
          },
        },
        {
          provide: AdminMonthService,
          useValue: {
            month: month.asReadonly(),
            isCurrentMonth: isCurrentMonth.asReadonly(),
            setMonth,
            shift,
            resetToCurrent,
            syncCurrentMonthForce,
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            open: signal(false).asReadonly(),
            completed: signal(true).asReadonly(),
            initForCurrentUser,
            openManual,
            complete: vi.fn(),
            dismiss: vi.fn(),
          },
        },
        { provide: PatientsService, useValue: { patients: patients.asReadonly(), loaded: signal(true).asReadonly() } },
        { provide: SessionsService, useValue: { watchAll: () => sessionsWatch } },
        { provide: PaymentsService, useValue: { payments: payments.asReadonly(), loaded: signal(true).asReadonly() } },
        { provide: ChargesService, useValue: { watchMonth: () => chargesWatch } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/inicio');
    fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renderiza exatamente as 4 abas e exibe badge de pendência em Atendimentos', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a')) as HTMLAnchorElement[];
    expect(links.map(l => l.getAttribute('href'))).toEqual([
      '/admin/inicio',
      '/admin/atendimentos',
      '/admin/financeiro',
      '/admin/pacientes',
    ]);
    expect(links[1].textContent).toContain('Atendimentos');
    expect(links[1].textContent).toContain('1');
  });

  it('dispara autoSync.runOnEntry e onboarding.initForCurrentUser na entrada', () => {
    expect(runOnEntry).toHaveBeenCalledTimes(1);
    expect(initForCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('abre o guia ao clicar em Como funciona', () => {
    const helpBtn = fixture.nativeElement.querySelector('button[aria-label="Como funciona"]') as HTMLButtonElement;
    helpBtn.click();
    expect(openManual).toHaveBeenCalledTimes(1);
  });

  it('oculta a barra de mês em /admin/pacientes e exibe nas demais rotas', async () => {
    expect(fixture.nativeElement.querySelector('[data-testid="admin-month-bar"]')).not.toBeNull();

    await router.navigateByUrl('/admin/pacientes');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="admin-month-bar"]')).toBeNull();
  });

  it('botão de atualizar força sync e reporta erro no toast quando falha', async () => {
    syncCurrentMonthForce.mockRejectedValueOnce(new Error('Falha de rede'));

    const refreshBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Atualizar agenda agora"]',
    ) as HTMLButtonElement;
    refreshBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(syncCurrentMonthForce).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith('Falha de rede');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Falha de rede');
  });
});
