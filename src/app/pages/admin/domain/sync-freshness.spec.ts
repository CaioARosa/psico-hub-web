import { syncFreshness, syncFreshnessNote } from './sync-freshness';

const now = new Date('2026-11-17T15:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

describe('syncFreshness', () => {
  it('mês passado não depende de sincronização (só conta realizadas)', () => {
    expect(syncFreshness({ month: '2026-10', now, lastSyncedAt: null })).toEqual({ kind: 'not_applicable' });
  });

  it('mês atual sem registro de sincronização é desconhecido', () => {
    expect(syncFreshness({ month: '2026-11', now, lastSyncedAt: null })).toEqual({ kind: 'unknown' });
  });

  it('sincronização de menos de 3 dias é recente', () => {
    const syncedAt = hoursAgo(71);
    expect(syncFreshness({ month: '2026-11', now, lastSyncedAt: syncedAt })).toEqual({ kind: 'fresh', syncedAt });
  });

  it('sincronização de 3 dias ou mais é antiga, com a contagem de dias', () => {
    const syncedAt = hoursAgo(24 * 5 + 2);
    expect(syncFreshness({ month: '2026-11', now, lastSyncedAt: syncedAt })).toEqual({
      kind: 'stale',
      syncedAt,
      days: 5,
    });
  });

  it('mês futuro também usa a sincronização (conta agendadas)', () => {
    expect(syncFreshness({ month: '2026-12', now, lastSyncedAt: null })).toEqual({ kind: 'unknown' });
  });

  it('virada de mês em UTC-3: 01/12 01:00Z ainda é novembro', () => {
    const lateNovember = new Date('2026-12-01T01:00:00Z');
    expect(syncFreshness({ month: '2026-11', now: lateNovember, lastSyncedAt: null })).toEqual({ kind: 'unknown' });
  });
});

describe('syncFreshnessNote', () => {
  const normalize = (text: string) => text.replace(/\s/g, ' ');

  it('não mostra nada em mês passado', () => {
    expect(syncFreshnessNote({ kind: 'not_applicable' })).toBeNull();
  });

  it('sem registro pede sincronização com destaque', () => {
    const note = syncFreshnessNote({ kind: 'unknown' });
    expect(note?.warn).toBe(true);
    expect(note?.text).toContain('Sincronize a agenda');
  });

  it('recente informa data e hora em BRT, sem destaque', () => {
    const note = syncFreshnessNote({ kind: 'fresh', syncedAt: new Date('2026-11-18T00:30:00Z') });
    expect(note?.warn).toBe(false);
    expect(normalize(note!.text)).toContain('17/11/2026, 21:30');
  });

  it('antiga informa os dias e pede sincronização', () => {
    const note = syncFreshnessNote({ kind: 'stale', syncedAt: new Date('2026-11-12T13:00:00Z'), days: 5 });
    expect(note?.warn).toBe(true);
    expect(note?.text).toContain('há 5 dias');
  });
});
