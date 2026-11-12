export interface SyncCounts {
  created: number;
  updated: number;
  unidentified: number;
  missing: number;
}

export function syncSummary(counts: SyncCounts): string {
  const created = `${counts.created} ${counts.created === 1 ? 'nova' : 'novas'}`;
  const updated = `${counts.updated} ${counts.updated === 1 ? 'atualizada' : 'atualizadas'}`;
  const unidentified = `${counts.unidentified} sem paciente`;
  const missing = `${counts.missing} ${counts.missing === 1 ? 'removida' : 'removidas'} do Agenda`;
  return `${created}, ${updated}, ${unidentified}, ${missing}`;
}
