import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { currentMonth, shiftMonth } from '../domain/month';
import { AdminMonthService } from './admin-month.service';
import { AutoSyncService, type AutoSyncOutcome } from './auto-sync.service';

const emptyOutcome: AutoSyncOutcome = {
  synced: [],
  skipped: [],
  totals: { created: 0, updated: 0, unidentified: 0, missing: 0 },
};

describe('AdminMonthService', () => {
  let run: ReturnType<typeof vi.fn<(months: string[], options?: { force?: boolean }) => Promise<AutoSyncOutcome>>>;

  function service(): AdminMonthService {
    return TestBed.inject(AdminMonthService);
  }

  beforeEach(() => {
    run = vi.fn(async () => emptyOutcome);
    TestBed.configureTestingModule({
      providers: [{ provide: AutoSyncService, useValue: { run } }],
    });
  });

  it('inicia no mês atual com isCurrentMonth true', () => {
    const adminMonth = service();
    expect(adminMonth.month()).toBe(currentMonth(new Date()));
    expect(adminMonth.isCurrentMonth()).toBe(true);
  });

  it('setMonth atualiza o mês válido e dispara autoSync.run([month])', () => {
    const adminMonth = service();
    const target = shiftMonth(adminMonth.month(), -1);

    adminMonth.setMonth(target);

    expect(adminMonth.month()).toBe(target);
    expect(adminMonth.isCurrentMonth()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith([target]);
  });

  it('setMonth ignora valor inválido e não dispara autoSync quando mês não muda', () => {
    const adminMonth = service();
    const initial = adminMonth.month();

    adminMonth.setMonth('2026-13');
    adminMonth.setMonth('invalido');
    adminMonth.setMonth(initial);

    expect(adminMonth.month()).toBe(initial);
    expect(run).not.toHaveBeenCalled();
  });

  it('shift recua/avança o mês e dispara autoSync', () => {
    const adminMonth = service();
    const initial = adminMonth.month();

    adminMonth.shift(-1);
    expect(adminMonth.month()).toBe(shiftMonth(initial, -1));
    expect(run).toHaveBeenLastCalledWith([shiftMonth(initial, -1)]);

    adminMonth.shift(1);
    expect(adminMonth.month()).toBe(initial);
    expect(run).toHaveBeenLastCalledWith([initial]);
  });

  it('resetToCurrent volta ao mês corrente e só sincroniza se estava em outro mês', () => {
    const adminMonth = service();
    const initial = adminMonth.month();

    adminMonth.resetToCurrent();
    expect(run).not.toHaveBeenCalled();

    adminMonth.shift(-2);
    run.mockClear();

    adminMonth.resetToCurrent();
    expect(adminMonth.month()).toBe(initial);
    expect(adminMonth.isCurrentMonth()).toBe(true);
    expect(run).toHaveBeenCalledWith([initial]);
  });

  it('syncCurrentMonthForce força a sincronização do mês ativo', async () => {
    const adminMonth = service();
    const active = adminMonth.month();

    await adminMonth.syncCurrentMonthForce();

    expect(run).toHaveBeenCalledWith([active], { force: true });
  });
});
