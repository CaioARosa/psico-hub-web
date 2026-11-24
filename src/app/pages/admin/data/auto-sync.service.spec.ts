import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AUTO_SYNC_ERROR, AutoSyncService } from './auto-sync.service';
import { CalendarSyncService, type SyncResult } from './calendar-sync.service';
import { CalendarSyncsService } from './calendar-syncs.service';

const result = (created: number): SyncResult => ({ created, updated: 0, unidentified: 0, missing: 0 });
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

describe('AutoSyncService', () => {
  let sync: ReturnType<typeof vi.fn<(month: string) => Promise<SyncResult>>>;
  let lastSyncedAtOnce: ReturnType<typeof vi.fn<(month: string) => Promise<Date | null>>>;

  function service(): AutoSyncService {
    return TestBed.inject(AutoSyncService);
  }

  beforeEach(() => {
    sync = vi.fn(async () => result(1));
    lastSyncedAtOnce = vi.fn(async () => null);
    TestBed.configureTestingModule({
      providers: [
        { provide: CalendarSyncService, useValue: { sync } },
        { provide: CalendarSyncsService, useValue: { lastSyncedAtOnce } },
      ],
    });
  });

  it('sincroniza meses sem registro e soma os totais', async () => {
    const outcome = await service().run(['2026-11', '2026-12']);

    expect(outcome.synced).toEqual(['2026-11', '2026-12']);
    expect(outcome.skipped).toEqual([]);
    expect(outcome.totals.created).toBe(2);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('pula mês sincronizado há menos de 6 h e guarda a data conhecida', async () => {
    const recent = hoursAgo(2);
    lastSyncedAtOnce.mockResolvedValue(recent);

    const auto = service();
    const outcome = await auto.run(['2026-11']);

    expect(outcome.skipped).toEqual(['2026-11']);
    expect(sync).not.toHaveBeenCalled();
    expect(auto.lastSyncedAt()).toEqual(recent);
  });

  it('sincroniza mês cuja última sincronização tem 6 h ou mais', async () => {
    lastSyncedAtOnce.mockResolvedValue(hoursAgo(7));

    const outcome = await service().run(['2026-11']);

    expect(outcome.synced).toEqual(['2026-11']);
  });

  it('force ignora a leitura e a regra das 6 h', async () => {
    lastSyncedAtOnce.mockResolvedValue(hoursAgo(1));

    const outcome = await service().run(['2026-11'], { force: true });

    expect(outcome.synced).toEqual(['2026-11']);
    expect(lastSyncedAtOnce).not.toHaveBeenCalled();
  });

  it('force propaga o erro do sync', async () => {
    sync.mockRejectedValue(new Error('Google Agenda não configurado.'));

    await expect(service().run(['2026-11'], { force: true })).rejects.toThrow('Google Agenda não configurado.');
  });

  it('sem force, erro de sync vira aviso e segue para o próximo mês', async () => {
    sync.mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce(result(3));

    const auto = service();
    const outcome = await auto.run(['2026-11', '2026-12']);

    expect(auto.error()).toBe(AUTO_SYNC_ERROR);
    expect(outcome.synced).toEqual(['2026-12']);
    expect(outcome.totals.created).toBe(3);
  });

  it('falha ao ler calendarSyncs é tratada como sem registro e sincroniza', async () => {
    lastSyncedAtOnce.mockRejectedValue(new Error('permission-denied'));

    const auto = service();
    const outcome = await auto.run(['2026-11']);

    expect(outcome.synced).toEqual(['2026-11']);
    expect(auto.error()).toBeNull();
  });

  it('duas chamadas simultâneas ao mesmo mês fazem um único sync', async () => {
    let finish!: (value: SyncResult) => void;
    sync.mockImplementation(() => new Promise<SyncResult>(resolve => (finish = resolve)));

    const auto = service();
    const first = auto.run(['2026-11']);
    const second = auto.run(['2026-11']);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    finish(result(1));
    const [a, b] = await Promise.all([first, second]);

    expect(sync).toHaveBeenCalledTimes(1);
    expect(a.synced).toEqual(['2026-11']);
    expect(b.skipped).toEqual(['2026-11']);
  });

  it('syncing fica verdadeiro durante a execução e falso depois', async () => {
    let finish!: (value: SyncResult) => void;
    sync.mockImplementation(() => new Promise<SyncResult>(resolve => (finish = resolve)));

    const auto = service();
    const running = auto.run(['2026-11']);
    await vi.waitFor(() => expect(sync).toHaveBeenCalled());
    expect(auto.syncing()).toBe(true);
    finish(result(1));
    await running;

    expect(auto.syncing()).toBe(false);
  });

  it('runOnEntry usa mês atual e o seguinte em UTC-3 e só roda uma vez', async () => {
    const auto = service();
    const now = new Date('2026-11-30T23:00:00-03:00');

    const first = await auto.runOnEntry(now);
    const second = await auto.runOnEntry(now);

    expect(first.synced).toEqual(['2026-11', '2026-12']);
    expect(second.synced).toEqual([]);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});
