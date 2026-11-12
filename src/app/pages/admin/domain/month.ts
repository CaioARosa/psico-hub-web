const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const UTC_OFFSET_HOURS = 3;
const BRT_OFFSET_MS = UTC_OFFSET_HOURS * 60 * 60 * 1000;

export function isValidMonth(month: string): boolean {
  return MONTH.test(month);
}

/** Janela do mês `YYYY-MM` em UTC-3 fixo: [início, início do mês seguinte). */
export function monthWindow(month: string): { start: Date; end: Date } {
  const match = MONTH.exec(month);
  if (!match) throw new Error(`Mês inválido: "${month}". Use o formato YYYY-MM.`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1, UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1, UTC_OFFSET_HOURS)),
  };
}

/** Mês (`YYYY-MM`) em que `now` cai em UTC-3. */
export function currentMonth(now: Date): string {
  return new Date(now.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 7);
}
