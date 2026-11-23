import { BRT_OFFSET_MS } from './month';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/** Data (`YYYY-MM-DD`) e hora (`HH:mm`) em America/Sao_Paulo (UTC-3 fixo) como instante absoluto. */
export function zonedDateTime(dateKey: string, time: string): Date {
  const dateMatch = DATE_KEY.exec(dateKey);
  if (!dateMatch) throw new Error(`Data inválida: "${dateKey}". Use o formato YYYY-MM-DD.`);
  const timeMatch = TIME.exec(time);
  if (!timeMatch) throw new Error(`Hora inválida: "${time}". Use o formato HH:mm.`);

  const [year, month, day] = dateMatch.slice(1).map(Number);
  const [hours, minutes] = timeMatch.slice(1).map(Number);
  if (hours > 23 || minutes > 59) throw new Error(`Hora inválida: "${time}".`);

  // Date.UTC normaliza estouros (30/02 -> 02/03); a ida e volta detecta datas impossíveis.
  const wallClock = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day
  ) {
    throw new Error(`Data inválida: "${dateKey}".`);
  }
  return new Date(wallClock.getTime() + BRT_OFFSET_MS);
}

function wallClockIso(date: Date): string {
  return new Date(date.getTime() - BRT_OFFSET_MS).toISOString();
}

/** Dia (`YYYY-MM-DD`) em que `date` cai em UTC-3. */
export function dateKeyOf(date: Date): string {
  return wallClockIso(date).slice(0, 10);
}

/** Hora (`HH:mm`) de `date` em UTC-3. */
export function timeOf(date: Date): string {
  return wallClockIso(date).slice(11, 16);
}
