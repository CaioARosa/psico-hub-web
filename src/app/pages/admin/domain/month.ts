const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const UTC_OFFSET_HOURS = 3;
/** UTC−3 fixo (Brasil sem horário de verão desde 2019). */
export const BRT_OFFSET_MS = UTC_OFFSET_HOURS * 60 * 60 * 1000;

export function isValidMonth(month: string): boolean {
  return MONTH.test(month);
}

export const MONTH_ABBREVIATIONS: readonly string[] = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function parseMonth(month: string): { year: number; monthIndex: number } {
  const match = MONTH.exec(month);
  if (!match) throw new Error(`Mês inválido: "${month}". Use o formato YYYY-MM.`);
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}

/** Soma `delta` meses (positivo ou negativo) a um `YYYY-MM`. */
export function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  const absolute = year * 12 + monthIndex + delta;
  const shiftedYear = Math.floor(absolute / 12);
  const shiftedMonth = (absolute % 12) + 1;
  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth).padStart(2, '0')}`;
}

/** Rótulo curto do mês, como `nov/26`; abreviações fixas porque `Intl` varia com o ICU. */
export function monthLabel(month: string): string {
  const { year, monthIndex } = parseMonth(month);
  return `${MONTH_ABBREVIATIONS[monthIndex]}/${String(year % 100).padStart(2, '0')}`;
}

/** Janela do mês `YYYY-MM` em UTC-3 fixo: [início, início do mês seguinte). */
export function monthWindow(month: string): { start: Date; end: Date } {
  const { year, monthIndex } = parseMonth(month);
  return {
    start: new Date(Date.UTC(year, monthIndex, 1, UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1, UTC_OFFSET_HOURS)),
  };
}

/** Mês (`YYYY-MM`) em que `now` cai em UTC-3. */
export function currentMonth(now: Date): string {
  return new Date(now.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 7);
}
