import { dateKeyOf } from './datetime';
import type { Session } from './models';
import { BRT_OFFSET_MS, currentMonth, MONTH_ABBREVIATIONS } from './month';

export interface WeekWindow {
  start: Date;
  end: Date;
}

export interface AgendaDay {
  dayKey: string;
  label: string;
  isToday: boolean;
  sessions: Session[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_ABBREVIATIONS: readonly string[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Janela da semana [segunda 00:00 UTC-3, segunda seguinte 00:00 UTC-3) que contém `date`. */
export function weekWindow(date: Date): WeekWindow {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const startWallClock = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const start = new Date(startWallClock + BRT_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { start, end };
}

/** Desloca o início da semana em `delta` semanas (positivo ou negativo). */
export function shiftWeek(start: Date, delta: number): Date {
  return new Date(start.getTime() + delta * 7 * DAY_MS);
}

/** Mês(es) (`YYYY-MM`) cobertos pelos 7 dias da semana (1 ou 2 itens). */
export function monthsInWindow(window: WeekWindow): string[] {
  const firstMonth = currentMonth(window.start);
  const lastMonth = currentMonth(new Date(window.end.getTime() - 1));
  return firstMonth === lastMonth ? [firstMonth] : [firstMonth, lastMonth];
}

/** Rótulo da semana: `'23 – 29 nov 2026'`, `'30 nov – 6 dez 2026'` ou `'28 dez 2026 – 3 jan 2027'`. */
export function weekLabel(window: WeekWindow): string {
  const first = new Date(window.start.getTime() - BRT_OFFSET_MS);
  const last = new Date(window.end.getTime() - 1 - BRT_OFFSET_MS);
  const d1 = first.getUTCDate();
  const m1 = MONTH_ABBREVIATIONS[first.getUTCMonth()];
  const y1 = first.getUTCFullYear();
  const d2 = last.getUTCDate();
  const m2 = MONTH_ABBREVIATIONS[last.getUTCMonth()];
  const y2 = last.getUTCFullYear();

  if (y1 !== y2) return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
  if (m1 !== m2) return `${d1} ${m1} – ${d2} ${m2} ${y2}`;
  return `${d1} – ${d2} ${m2} ${y2}`;
}

function formatDayLabel(date: Date, isToday: boolean): string {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  const weekday = WEEKDAY_ABBREVIATIONS[local.getUTCDay()];
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = MONTH_ABBREVIATIONS[local.getUTCMonth()];
  const base = `${weekday}, ${day}/${month}`;
  return isToday ? `Hoje · ${base}` : base;
}

/** Agrupa sessões da janela por dia (em UTC-3), ordenadas por horário e omitindo dias vazios. */
export function groupByDay(sessions: Session[], window: WeekWindow, now: Date): AgendaDay[] {
  const startMs = window.start.getTime();
  const endMs = window.end.getTime();
  const todayKey = dateKeyOf(now);

  const inWindow = sessions
    .filter(s => {
      const ms = s.startsAt.getTime();
      return ms >= startMs && ms < endMs;
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const byDay = new Map<string, AgendaDay>();
  for (const session of inWindow) {
    const dayKey = dateKeyOf(session.startsAt);
    let day = byDay.get(dayKey);
    if (!day) {
      const isToday = dayKey === todayKey;
      day = {
        dayKey,
        label: formatDayLabel(session.startsAt, isToday),
        isToday,
        sessions: [],
      };
      byDay.set(dayKey, day);
    }
    day.sessions.push(session);
  }

  return Array.from(byDay.values());
}
