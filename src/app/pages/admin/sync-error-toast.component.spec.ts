import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AdminMonthService } from './data/admin-month.service';
import { AutoSyncService, type AutoSyncOutcome } from './data/auto-sync.service';
import { SyncErrorToastComponent } from './sync-error-toast.component';

const emptyOutcome: AutoSyncOutcome = {
  synced: ['2026-11'],
  skipped: [],
  totals: { created: 0, updated: 0, unidentified: 0, missing: 0 },
};

describe('SyncErrorToastComponent', () => {
  let fixture: ComponentFixture<SyncErrorToastComponent>;
  const error = signal<string | null>(null);
  const errorNonce = signal(0);
  const clearError = vi.fn(() => error.set(null));
  const reportError = vi.fn((msg: string) => {
    error.set(msg);
    errorNonce.update(n => n + 1);
  });
  const syncCurrentMonthForce = vi.fn<() => Promise<AutoSyncOutcome>>();

  beforeEach(async () => {
    error.set(null);
    errorNonce.set(0);
    clearError.mockClear();
    reportError.mockClear();
    syncCurrentMonthForce.mockReset().mockResolvedValue(emptyOutcome);

    await TestBed.configureTestingModule({
      imports: [SyncErrorToastComponent],
      providers: [
        {
          provide: AutoSyncService,
          useValue: {
            error: error.asReadonly(),
            errorNonce: errorNonce.asReadonly(),
            clearError,
            reportError,
          },
        },
        { provide: AdminMonthService, useValue: { syncCurrentMonthForce } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SyncErrorToastComponent);
    fixture.detectChanges();
  });

  it('não renderiza alerta quando não há erro de sincronização', () => {
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('exibe toast com mensagem e botão Tentar novamente quando há erro', () => {
    reportError('Não foi possível atualizar a agenda agora.');
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Não foi possível atualizar a agenda agora.');
    expect(toast?.textContent).toContain('Tentar novamente');
  });

  it('fecha ao clicar no botão de fechar e reaparece quando um novo erro acontece', () => {
    reportError('Erro 1');
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('button[aria-label="Fechar aviso"]') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    reportError('Erro 2');
    fixture.detectChanges();
    const toast = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(toast?.textContent).toContain('Erro 2');
  });

  it('Tentar novamente força sync e limpa o toast em caso de sucesso', async () => {
    reportError('Falha temporária');
    fixture.detectChanges();

    const retryBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(btn =>
      (btn as HTMLButtonElement).textContent?.includes('Tentar novamente'),
    ) as HTMLButtonElement;
    retryBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(syncCurrentMonthForce).toHaveBeenCalledTimes(1);
    expect(clearError).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('Tentar novamente atualiza o toast com a nova mensagem quando falha de novo', async () => {
    syncCurrentMonthForce.mockRejectedValueOnce(new Error('Google Agenda sem conexão.'));
    reportError('Falha inicial');
    fixture.detectChanges();

    const retryBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(btn =>
      (btn as HTMLButtonElement).textContent?.includes('Tentar novamente'),
    ) as HTMLButtonElement;
    retryBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(toast?.textContent).toContain('Google Agenda sem conexão.');
  });
});
