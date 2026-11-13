import { currentMonth } from './month';
import { packageAmountForNewSession } from './money';
import type { Agreement, Patient, Payment, Session } from './models';

export interface MonthAllocation {
  month: string;
  due: number;
  received: number;
  abated: number;
  toReceive: number;
  credit: number;
  sources: Array<{ fromMonth: string; amount: number }>;
}

export interface PatientMonthLine {
  patientId: string;
  month: string;
  due: number;
  received: number;
  abated: number;
  toReceive: number;
  overdue: number;
  credit: number;
  sources: MonthAllocation['sources'];
}

export interface MonthTotals {
  due: number;
  received: number;
  abated: number;
  toReceive: number;
  overdue: number;
  credit: number;
}

export interface MonthSummary {
  month: string;
  received: number;
  toReceive: number;
  overdue: number;
  totals: MonthTotals;
  hasSessions: boolean;
  unlinkedSessions: number;
  lines: PatientMonthLine[];
}

/** Alocações por paciente, nomes, meses com sessão e sessões sem paciente por mês. Opaco para quem consome. */
export type Ledger = {
  readonly names: ReadonlyMap<string, string>;
  readonly allocations: ReadonlyMap<string, MonthAllocation[]>;
  readonly sessionMonths: ReadonlySet<string>;
  readonly unlinkedByMonth: ReadonlyMap<string, number>;
};

export const REMOVED_PATIENT_LABEL = 'Paciente removido';

/** Devido do paciente por mês, só com meses de valor maior que zero. */
export function dueByMonth(patient: Patient, sessions: Session[]): Map<string, number> {
  return dueFor(
    patient.agreement,
    sessions.filter(session => session.patientId === patient.id),
  );
}

/** Abatimento por crédito (spec §3): déficits antigos são cobertos pelos excedentes posteriores. */
export function allocateCredits(
  due: Map<string, number>,
  received: Map<string, number>,
): MonthAllocation[] {
  const months = [...new Set([...due.keys(), ...received.keys()])].sort();
  const allocations: MonthAllocation[] = [];
  const openDeficits: Array<{ allocation: MonthAllocation; remaining: number }> = [];

  for (const month of months) {
    const allocation: MonthAllocation = {
      month,
      due: due.get(month) ?? 0,
      received: received.get(month) ?? 0,
      abated: 0,
      toReceive: 0,
      credit: 0,
      sources: [],
    };
    allocations.push(allocation);

    const net = allocation.received - allocation.due;
    if (net < 0) {
      openDeficits.push({ allocation, remaining: -net });
    } else {
      let excess = net;
      while (excess > 0 && openDeficits.length > 0) {
        const deficit = openDeficits[0];
        const amount = Math.min(excess, deficit.remaining);
        deficit.allocation.abated += amount;
        deficit.allocation.sources.push({ fromMonth: month, amount });
        deficit.remaining -= amount;
        excess -= amount;
        if (deficit.remaining === 0) openDeficits.shift();
      }
      allocation.credit = excess;
    }
  }

  for (const allocation of allocations) {
    allocation.toReceive = Math.max(0, allocation.due - allocation.received) - allocation.abated;
  }
  return allocations;
}

export function buildLedger(input: {
  patients: Patient[];
  sessions: Session[];
  payments: Payment[];
}): Ledger {
  const patientsById = new Map(input.patients.map(patient => [patient.id, patient] as const));
  const sessionsByPatient = groupBy(input.sessions, session => session.patientId);
  const paymentsByPatient = groupBy(input.payments, payment => payment.patientId);
  const patientIds = new Set([
    ...patientsById.keys(),
    ...sessionsByPatient.keys(),
    ...paymentsByPatient.keys(),
  ]);

  const names = new Map<string, string>();
  const allocations = new Map<string, MonthAllocation[]>();
  for (const patientId of patientIds) {
    const patient = patientsById.get(patientId);
    names.set(patientId, patient?.name ?? REMOVED_PATIENT_LABEL);
    const due = dueFor(patient?.agreement ?? null, sessionsByPatient.get(patientId) ?? []);
    const received = receivedByMonth(paymentsByPatient.get(patientId) ?? []);
    allocations.set(patientId, allocateCredits(due, received));
  }

  const unlinkedByMonth = new Map<string, number>();
  for (const session of input.sessions) {
    if (session.patientId !== null) continue;
    const sessionMonth = currentMonth(session.startsAt);
    unlinkedByMonth.set(sessionMonth, (unlinkedByMonth.get(sessionMonth) ?? 0) + 1);
  }

  return {
    names,
    allocations,
    sessionMonths: new Set(input.sessions.map(session => currentMonth(session.startsAt))),
    unlinkedByMonth,
  };
}

/** Resumo de um mês: totals é a soma das linhas e alimenta os cartões e a linha de total; só entram pacientes com movimento. */
export function summarizeMonth(ledger: Ledger, month: string): MonthSummary {
  const lines: PatientMonthLine[] = [];
  for (const [patientId, allocations] of ledger.allocations) {
    const line = lineFor(patientId, allocations, month);
    if (line) lines.push(line);
  }

  const nameOf = (patientId: string) => ledger.names.get(patientId) ?? REMOVED_PATIENT_LABEL;
  lines.sort(
    (a, b) =>
      nameOf(a.patientId).localeCompare(nameOf(b.patientId), 'pt-BR') ||
      a.patientId.localeCompare(b.patientId),
  );

  const totals: MonthTotals = {
    due: sumOf(lines, line => line.due),
    received: sumOf(lines, line => line.received),
    abated: sumOf(lines, line => line.abated),
    toReceive: sumOf(lines, line => line.toReceive),
    overdue: sumOf(lines, line => line.overdue),
    credit: sumOf(lines, line => line.credit),
  };

  return {
    month,
    received: totals.received,
    toReceive: totals.toReceive,
    overdue: totals.overdue,
    totals,
    hasSessions: ledger.sessionMonths.has(month),
    unlinkedSessions: ledger.unlinkedByMonth.get(month) ?? 0,
    lines,
  };
}

function dueFor(agreement: Agreement | null, sessions: Session[]): Map<string, number> {
  const ordered = [...sessions].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id),
  );
  const byMonth = groupBy(ordered, session => currentMonth(session.startsAt));

  const due = new Map<string, number>();
  for (const [month, monthSessions] of byMonth) {
    const perSession = sumOf(monthSessions, session => sessionCharge(session, agreement));
    const total = perSession + packageCharge(monthSessions, agreement);
    if (total > 0) due.set(month, total);
  }
  return due;
}

function sessionCharge(session: Session, agreement: Agreement | null): number {
  if (session.status === 'done') return session.amountApplied;
  if (session.status !== 'no_show') return 0;
  const chargesNoShow = session.chargeNoShowApplied ?? agreement?.chargeNoShow ?? false;
  return chargesNoShow ? session.amountApplied : 0;
}

/** Pacote do mês: valor da primeira sessão não cancelada (sessões já ordenadas por data). */
function packageCharge(monthSessions: Session[], agreement: Agreement | null): number {
  const first = monthSessions.find(session => session.status !== 'cancelled');
  if (!first) return 0;
  // Sessão sem valor congelado (anterior à Fase 2): regra de sessão nova sobre o acordo atual.
  return first.packageAmountApplied ?? packageAmountForNewSession(agreement);
}

function receivedByMonth(payments: Payment[]): Map<string, number> {
  const received = new Map<string, number>();
  for (const payment of payments) {
    received.set(
      payment.referenceMonth,
      (received.get(payment.referenceMonth) ?? 0) + payment.amount,
    );
  }
  return received;
}

function lineFor(
  patientId: string,
  allocations: MonthAllocation[],
  month: string,
): PatientMonthLine | null {
  const current = allocations.find(allocation => allocation.month === month);
  const overdue = sumOf(
    allocations.filter(allocation => allocation.month < month),
    allocation => allocation.toReceive,
  );
  const line: PatientMonthLine = {
    patientId,
    month,
    due: current?.due ?? 0,
    received: current?.received ?? 0,
    abated: current?.abated ?? 0,
    toReceive: current?.toReceive ?? 0,
    overdue,
    credit: current?.credit ?? 0,
    sources: [...(current?.sources ?? [])],
  };
  const hasMovement =
    line.due > 0 || line.received > 0 || line.toReceive > 0 || line.overdue > 0 || line.credit > 0;
  return hasMovement ? line : null;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null) continue;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function sumOf<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}
