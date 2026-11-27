import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdminMonthService } from '../data/admin-month.service';
import { AutoSyncService, type AutoSyncOutcome } from '../data/auto-sync.service';
import { OnboardingService } from '../data/onboarding.service';
import { PatientsService } from '../data/patients.service';
import type { Patient } from '../domain/models';
import { OnboardingModalComponent } from './onboarding-modal.component';

const activePatient: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: true },
};

describe('OnboardingModalComponent', () => {
  let fixture: ComponentFixture<OnboardingModalComponent>;
  let router: Router;

  const open = signal(true);
  const patients = signal<Patient[]>([]);
  const syncing = signal(false);
  const dismiss = vi.fn(() => open.set(false));
  const complete = vi.fn(() => open.set(false));
  const syncCurrentMonthForce = vi.fn<() => Promise<AutoSyncOutcome>>();

  beforeEach(async () => {
    open.set(true);
    patients.set([]);
    syncing.set(false);
    dismiss.mockClear();
    complete.mockClear();
    syncCurrentMonthForce.mockReset().mockResolvedValue({
      synced: ['2026-11'],
      skipped: [],
      totals: { created: 4, updated: 0, unidentified: 1, missing: 0 },
    });

    await TestBed.configureTestingModule({
      imports: [OnboardingModalComponent],
      providers: [
        provideRouter([]),
        { provide: OnboardingService, useValue: { open: open.asReadonly(), dismiss, complete } },
        { provide: PatientsService, useValue: { patients: patients.asReadonly(), loaded: signal(true).asReadonly() } },
        { provide: AutoSyncService, useValue: { syncing: syncing.asReadonly(), lastSyncedAt: signal<Date | null>(null).asReadonly() } },
        { provide: AdminMonthService, useValue: { month: signal('2026-11').asReadonly(), syncCurrentMonthForce } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(OnboardingModalComponent);
    fixture.detectChanges();
  });

  function clickButton(text: string): void {
    const btn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(b =>
      (b as HTMLButtonElement).textContent?.includes(text),
    ) as HTMLButtonElement | undefined;
    expect(btn, `botão "${text}" não encontrado`).toBeDefined();
    btn!.click();
    fixture.detectChanges();
  }

  it('não renderiza o dialog quando onboarding.open() é false', () => {
    open.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('mostra Passo 1 de 4 com botão Pular e fecha com Escape ou Pular', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Passo 1 de 4');
    expect(dialog.textContent).toContain('Pular e explorar');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('Passo 2 mostra CTA para cadastrar paciente quando vazio e selo de pronto quando há pacientes ativos', () => {
    clickButton('Começar guia');
    expect(fixture.nativeElement.textContent).toContain('Passo 2 de 4');
    expect(fixture.nativeElement.textContent).toContain('Cadastrar primeiro paciente');

    patients.set([activePatient, { ...activePatient, id: 'p2', name: 'Bia' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 pacientes ativos');
  });

  it('Passo 2 navega para /admin/pacientes?novo=1 ao clicar em Cadastrar primeiro paciente', () => {
    clickButton('Começar guia');
    clickButton('Cadastrar primeiro paciente');

    expect(complete).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/pacientes'], { queryParams: { novo: '1' } });
  });

  it('Passo 3 ensina a sincronização automática de 3 meses e permite sincronizar ali mesmo', async () => {
    clickButton('Começar guia');
    clickButton('Próximo');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Passo 3 de 4');
    expect(text).toContain('mês passado, o mês atual e o próximo');
    expect(text).toContain('não precisa clicar');

    clickButton('Sincronizar agora');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(syncCurrentMonthForce).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('4');
  });

  it('Passo 4 finaliza e navega para /admin/inicio', () => {
    clickButton('Começar guia');
    clickButton('Próximo');
    clickButton('Próximo');

    expect(fixture.nativeElement.textContent).toContain('Passo 4 de 4');
    clickButton('Ir para o Início');

    expect(complete).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/inicio']);
  });
});
