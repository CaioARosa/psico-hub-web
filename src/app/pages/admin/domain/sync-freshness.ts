import { currentMonth } from './month';
import { formatSessionDateTime } from './sessions-view';

/** A partir de quantos dias a sincronização do mês deixa de ser confiável para os alertas de falta. */
export const STALE_AFTER_DAYS = 3;

/** Depois de quantas horas a sincronização do mês é refeita automaticamente ao abrir o painel. */
export const AUTO_SYNC_AFTER_HOURS = 6;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Sem registro, com registro de {@link AUTO_SYNC_AFTER_HOURS} horas ou mais, ou com registro mais de 1 h no futuro
 * (relógio do aparelho atrasado: sem esse limite a agenda ficaria dias sem sincronizar). Até 1 h no futuro é só
 * diferença de relógio e conta como recente.
 */
export function needsAutoSync(lastSyncedAt: Date | null, now: Date): boolean {
  if (!lastSyncedAt) return true;
  const elapsed = now.getTime() - lastSyncedAt.getTime();
  return elapsed >= AUTO_SYNC_AFTER_HOURS * HOUR_MS || elapsed < -HOUR_MS;
}

/** Rótulo curto de quanto tempo faz que a agenda foi sincronizada: `há 30 min`, `há 5 h`, `há 2 dias`. */
export function syncedAgoLabel(syncedAt: Date, now: Date): string {
  const elapsed = now.getTime() - syncedAt.getTime();
  if (elapsed < MINUTE_MS) return 'agora há pouco';
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  return `há ${Math.floor(elapsed / DAY_MS)} dias`;
}

export type SyncFreshness =
  | { kind: 'not_applicable' }
  | { kind: 'unknown' }
  | { kind: 'fresh'; syncedAt: Date }
  | { kind: 'stale'; syncedAt: Date; days: number };

/**
 * Quão atual está a sincronização do mês para os alertas de frequência.
 * Meses passados só contam realizadas, então não dependem da agenda; no mês corrente e futuros,
 * sessões marcadas no Agenda depois da última sincronização ainda não aparecem como agendadas.
 */
export function syncFreshness(input: { month: string; now: Date; lastSyncedAt: Date | null }): SyncFreshness {
  const { month, now, lastSyncedAt } = input;
  if (month < currentMonth(now)) return { kind: 'not_applicable' };
  if (!lastSyncedAt) return { kind: 'unknown' };
  const days = Math.floor((now.getTime() - lastSyncedAt.getTime()) / DAY_MS);
  return days >= STALE_AFTER_DAYS ? { kind: 'stale', syncedAt: lastSyncedAt, days } : { kind: 'fresh', syncedAt: lastSyncedAt };
}

/** Texto do bloco de alertas; `warn` pede destaque e um atalho para sincronizar. `null` quando não se aplica. */
export function syncFreshnessNote(freshness: SyncFreshness): { text: string; warn: boolean } | null {
  switch (freshness.kind) {
    case 'not_applicable':
      return null;
    case 'unknown':
      return {
        text: 'Não há registro de sincronização deste mês. Sincronize a agenda antes de confiar nos alertas de falta.',
        warn: true,
      };
    case 'fresh':
      return {
        text: `Agendadas contadas até a sincronização de ${formatSessionDateTime(freshness.syncedAt)}.`,
        warn: false,
      };
    case 'stale':
      return {
        text: `A agenda deste mês foi sincronizada há ${freshness.days} dias (${formatSessionDateTime(freshness.syncedAt)}). Sessões marcadas depois disso ainda não contam: sincronize antes de confiar nos alertas de falta.`,
        warn: true,
      };
  }
}
