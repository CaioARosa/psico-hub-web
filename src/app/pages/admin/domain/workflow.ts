import { whatsappChargeUrl } from './charge-message';
import { buildChargeQueue } from './charge-queue';
import { REMOVED_PATIENT_LABEL, type MonthSummary, type PatientMonthLine } from './finance';
import type { Patient, Session } from './models';
import { centsToInput, formatCents } from './money';
import { currentMonth, shiftMonth } from './month';
import { pixPrefillQuery, type PixPrefill } from './pix-prefill';
import { groupSessions } from './sessions-view';

export type WorkflowStepId = 'patients' | 'sync' | 'sessions' | 'finance';
export type WorkflowStepStatus = 'done' | 'in_progress' | 'pending';

export interface WorkflowStep {
  id: WorkflowStepId;
  index: number;
  title: string;
  summary: string;
  status: WorkflowStepStatus;
  ctaLabel: string;
  route: string;
  queryParams?: Record<string, string>;
}

export interface WorkflowState {
  steps: WorkflowStep[];
  nextStep: WorkflowStep | null;
  allClear: boolean;
  atendimentosBadge: number;
  financeiroBadge: number;
  unidentifiedCount: number;
  pendingConfirmationCount: number;
  previousMonthPendingCount: number;
  previousMonth: string;
}

export interface WorkflowInput {
  patients: Patient[];
  sessions: Session[];
  summary: MonthSummary;
  charges: ReadonlyMap<string, Date>;
  month: string;
  now: Date;
  syncing: boolean;
  lastSyncedAt: Date | null;
}

export type FinanceRowStatus = 'overdue' | 'open' | 'pending_sync' | 'credit' | 'paid';

export interface FinanceDisplayRow {
  line: PatientMonthLine;
  name: string;
  status: FinanceRowStatus;
  statusLabel: string;
  headline: string;
  subline: string;
  pixQuery: Record<string, string> | null;
  pixPrefill: PixPrefill | null;
  chargeUrl: string | null;
  chargedAt: Date | null;
  invalidPhone: boolean;
}

const STATUS_PRIORITY: Record<FinanceRowStatus, number> = {
  overdue: 0,
  open: 1,
  pending_sync: 2,
  credit: 3,
  paid: 4,
};

const STATUS_LABEL: Record<FinanceRowStatus, string> = {
  overdue: 'Em atraso',
  open: 'A receber',
  pending_sync: 'Aguardando sessões',
  credit: 'Com crédito',
  paid: 'Pago',
};

function plural(count: number, singular: string, pluralWord: string): string {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

export function buildWorkflowState(input: WorkflowInput): WorkflowState {
  const { patients, sessions, summary, charges, month, now, syncing, lastSyncedAt } = input;
  const activePatientsCount = patients.filter(p => p.active).length;
  const previousMonth = shiftMonth(month, -1);

  const monthSessions = sessions.filter(s => currentMonth(s.startsAt) === month);
  const prevMonthSessions = sessions.filter(s => currentMonth(s.startsAt) === previousMonth);

  const currentGroups = groupSessions(monthSessions, now);
  const prevGroups = groupSessions(prevMonthSessions, now);

  const unidentifiedCount = currentGroups.unidentified.length;
  const pendingConfirmationCount = currentGroups.pending.length;
  const previousMonthPendingCount = prevGroups.unidentified.length + prevGroups.pending.length;
  const atendimentosBadge = unidentifiedCount + pendingConfirmationCount + previousMonthPendingCount;

  const patientsMap = new Map(patients.map(p => [p.id, p] as const));
  const queue = buildChargeQueue({
    lines: summary.lines,
    patients: patientsMap,
    charges,
    hasLinkedSessions: summary.hasLinkedSessions,
    now,
  });
  const chargeableCount = queue.items.filter(item => !item.recentlyCharged).length;
  const financeiroBadge = chargeableCount;

  const patientsStep: WorkflowStep = {
    id: 'patients',
    index: 1,
    title: 'Pacientes e acordos',
    summary:
      activePatientsCount > 0
        ? `${plural(activePatientsCount, 'paciente ativo', 'pacientes ativos')}`
        : 'Cadastre seus pacientes e valores combinados',
    status: activePatientsCount > 0 ? 'done' : 'pending',
    ctaLabel: activePatientsCount > 0 ? 'Ver pacientes' : 'Cadastrar paciente',
    route: '/admin/pacientes',
    ...(activePatientsCount === 0 ? { queryParams: { novo: '1' } } : {}),
  };

  const syncDone = !syncing && (summary.hasSessions || lastSyncedAt !== null);
  const syncStep: WorkflowStep = {
    id: 'sync',
    index: 2,
    title: 'Agenda sincronizada',
    summary: syncing
      ? 'Buscando sessões no Google Agenda…'
      : syncDone
        ? 'Agenda conectada e atualizada'
        : 'Aguardando sincronização do mês',
    status: syncing ? 'in_progress' : syncDone ? 'done' : 'pending',
    ctaLabel: 'Ver atendimentos',
    route: '/admin/atendimentos',
    queryParams: { aba: 'semana' },
  };

  const sessionsParts: string[] = [];
  if (unidentifiedCount > 0) sessionsParts.push(`${unidentifiedCount} sem paciente`);
  if (pendingConfirmationCount > 0) sessionsParts.push(`${pendingConfirmationCount} para confirmar`);
  if (previousMonthPendingCount > 0) sessionsParts.push(`${previousMonthPendingCount} do mês anterior`);

  const sessionsDone = syncDone && atendimentosBadge === 0;
  const sessionsStep: WorkflowStep = {
    id: 'sessions',
    index: 3,
    title: 'Confirmar atendimentos',
    summary:
      atendimentosBadge > 0
        ? sessionsParts.join(' · ')
        : syncDone
          ? 'Nenhuma pendência de atendimento'
          : 'Aguardando agenda sincronizar',
    status: sessionsDone ? 'done' : 'pending',
    ctaLabel: atendimentosBadge > 0 ? `Resolver ${plural(atendimentosBadge, 'pendência', 'pendências')}` : 'Ver atendimentos',
    route: '/admin/atendimentos',
    queryParams: { aba: 'pendencias' },
  };

  const toReceiveTotal = summary.hasLinkedSessions ? summary.toReceive : 0;
  const overdueTotal = summary.hasLinkedSessions ? summary.overdue : 0;
  const financeDone = sessionsDone && chargeableCount === 0 && toReceiveTotal === 0 && overdueTotal === 0;

  let financeSummary = 'Tudo em dia neste mês';
  if (chargeableCount > 0) {
    financeSummary = `${plural(chargeableCount, 'paciente pronta', 'pacientes prontas')} para cobrar`;
  } else if (overdueTotal > 0) {
    financeSummary = `${formatCents(overdueTotal)} em atraso`;
  } else if (toReceiveTotal > 0) {
    financeSummary = `${formatCents(toReceiveTotal)} a receber`;
  } else if (!sessionsDone) {
    financeSummary = 'Confirme os atendimentos para fechar o mês';
  }

  const financeStep: WorkflowStep = {
    id: 'finance',
    index: 4,
    title: 'Receber e cobrar',
    summary: financeSummary,
    status: financeDone ? 'done' : 'pending',
    ctaLabel: chargeableCount > 0 ? `Cobrar ${plural(chargeableCount, 'paciente', 'pacientes')}` : 'Abrir Financeiro',
    route: '/admin/financeiro',
    ...(chargeableCount > 0 ? { queryParams: { aba: 'cobrar' } } : {}),
  };

  const steps = [patientsStep, syncStep, sessionsStep, financeStep];
  const nextStep = steps.find(step => step.status !== 'done') ?? null;

  return {
    steps,
    nextStep,
    allClear: nextStep === null,
    atendimentosBadge,
    financeiroBadge,
    unidentifiedCount,
    pendingConfirmationCount,
    previousMonthPendingCount,
    previousMonth,
  };
}

export function buildFinanceRows(input: {
  summary: MonthSummary;
  patients: ReadonlyMap<string, Patient>;
  charges: ReadonlyMap<string, Date>;
}): FinanceDisplayRow[] {
  const { summary, patients, charges } = input;
  const hasLinked = summary.hasLinkedSessions;

  const rows = summary.lines.map((line): FinanceDisplayRow => {
    const patient = patients.get(line.patientId);
    const name = patient?.name ?? REMOVED_PATIENT_LABEL;

    let status: FinanceRowStatus;
    if (!hasLinked) {
      status = 'pending_sync';
    } else if (line.overdue > 0) {
      status = 'overdue';
    } else if (line.toReceive > 0) {
      status = 'open';
    } else if (line.credit > 0) {
      status = 'credit';
    } else {
      status = 'paid';
    }

    const totalOpen = line.toReceive + line.overdue;
    const canCharge = hasLinked && line.overdue > 0 && patient !== undefined;
    const chargeUrl = canCharge ? whatsappChargeUrl(patient.phone, patient.name, totalOpen) : null;

    let headline: string;
    let subline: string;
    switch (status) {
      case 'overdue':
        headline = `Em aberto: ${formatCents(totalOpen)}`;
        subline =
          line.toReceive > 0
            ? `${formatCents(line.overdue)} de atraso + ${formatCents(line.toReceive)} deste mês`
            : `${formatCents(line.overdue)} de meses anteriores`;
        break;
      case 'open':
        headline = `Falta ${formatCents(line.toReceive)}`;
        subline = `Recebido ${formatCents(line.received)} de ${formatCents(line.due)}`;
        break;
      case 'credit':
        headline = `Crédito de ${formatCents(line.credit)}`;
        subline = `Recebido ${formatCents(line.received)} · devido ${formatCents(line.due)}`;
        break;
      case 'pending_sync':
        headline = `Recebido ${formatCents(line.received)}`;
        subline = 'Sessões deste mês ainda não vinculadas';
        break;
      case 'paid':
        headline = `Quitado · ${formatCents(line.due)}`;
        subline =
          line.abated > 0
            ? `Pago com ${formatCents(line.received)} + ${formatCents(line.abated)} de crédito`
            : `Recebido ${formatCents(line.received)}`;
        break;
    }

    const suggestedPix = line.toReceive > 0 ? line.toReceive : line.overdue > 0 ? line.overdue : 0;
    const pixPrefill: PixPrefill | null =
      hasLinked && suggestedPix > 0 && patient
        ? { patientId: line.patientId, referenceMonth: line.month, amount: centsToInput(suggestedPix) }
        : null;
    const pixQuery = hasLinked && line.toReceive > 0 ? pixPrefillQuery(line) : null;

    return {
      line,
      name,
      status,
      statusLabel: STATUS_LABEL[status],
      headline,
      subline,
      pixQuery,
      pixPrefill,
      chargeUrl,
      chargedAt: charges.get(line.patientId) ?? null,
      invalidPhone: canCharge && chargeUrl === null,
    };
  });

  return rows.sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    const amountA = a.line.overdue + a.line.toReceive;
    const amountB = b.line.overdue + b.line.toReceive;
    if (amountB !== amountA) return amountB - amountA;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}
