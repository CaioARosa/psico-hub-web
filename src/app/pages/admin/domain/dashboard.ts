import { summarizeMonth } from './finance';
import type { Ledger } from './finance';
import { currentMonth, shiftMonth } from './month';
import type { Patient, Session } from './models';

export interface FrequencyAlert {
  patientId: string;
  name: string;
  contracted: number;
  counted: number;
  /** counted − contracted: negativo = falta, positivo = sobra. */
  difference: number;
}

export interface DashboardPoint {
  month: string;
  received: number;
  due: number;
}

export interface Dashboard {
  month: string;
  patientsAttended: number;
  done: number;
  noShow: number;
  cancelled: number;
  received: number;
  due: number;
  expected: number;
  hasSessions: boolean;
  hasLinkedSessions: boolean;
  unlinkedSessions: number;
  /** true quando o mês é o corrente ou futuro (o alerta conta `done + scheduled`). */
  countsScheduled: boolean;
  alerts: FrequencyAlert[];
  series: DashboardPoint[];
}

const SERIES_MONTHS = 6;

export function buildDashboard(input: {
  ledger: Ledger;
  patients: Patient[];
  sessions: Session[];
  month: string;
  now: Date;
}): Dashboard {
  const { ledger, patients, month, now } = input;
  const monthSessions = input.sessions.filter(
    session => session.patientId !== null && currentMonth(session.startsAt) === month,
  );
  const done = monthSessions.filter(session => session.status === 'done');
  const summary = summarizeMonth(ledger, month);
  const countsScheduled = month >= currentMonth(now);

  const series: DashboardPoint[] = [];
  for (let offset = SERIES_MONTHS - 1; offset >= 0; offset--) {
    const seriesMonth = shiftMonth(month, -offset);
    const { totals } = summarizeMonth(ledger, seriesMonth);
    series.push({ month: seriesMonth, received: totals.received, due: totals.due });
  }

  return {
    month,
    patientsAttended: new Set(done.map(session => session.patientId)).size,
    done: done.length,
    noShow: monthSessions.filter(session => session.status === 'no_show').length,
    cancelled: monthSessions.filter(session => session.status === 'cancelled').length,
    received: summary.totals.received,
    due: summary.totals.due,
    expected: expectedFor(patients),
    hasSessions: summary.hasSessions,
    hasLinkedSessions: summary.hasLinkedSessions,
    unlinkedSessions: summary.unlinkedSessions,
    countsScheduled,
    alerts: summary.hasLinkedSessions ? alertsFor(patients, monthSessions, countsScheduled) : [],
    series,
  };
}

function alertsFor(
  patients: Patient[],
  monthSessions: Session[],
  countsScheduled: boolean,
): FrequencyAlert[] {
  const countedByPatient = new Map<string, number>();
  for (const { patientId, status, missingFromCalendar } of monthSessions) {
    const counts =
      status === 'done' || (countsScheduled && status === 'scheduled' && !missingFromCalendar);
    if (patientId !== null && counts) {
      countedByPatient.set(patientId, (countedByPatient.get(patientId) ?? 0) + 1);
    }
  }

  const alerts: FrequencyAlert[] = [];
  for (const { id, name, active, agreement } of patients) {
    if (!active || agreement.sessionsPerMonth <= 0) continue;
    const counted = countedByPatient.get(id) ?? 0;
    if (counted === agreement.sessionsPerMonth) continue;
    alerts.push({
      patientId: id,
      name,
      contracted: agreement.sessionsPerMonth,
      counted,
      difference: counted - agreement.sessionsPerMonth,
    });
  }
  return alerts.sort(
    (a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.patientId.localeCompare(b.patientId),
  );
}

function expectedFor(patients: Patient[]): number {
  let total = 0;
  for (const { active, agreement } of patients) {
    if (!active || agreement.sessionsPerMonth <= 0) continue;
    total +=
      agreement.type === 'per_session'
        ? agreement.sessionsPerMonth * agreement.amount
        : agreement.amount;
  }
  return total;
}
