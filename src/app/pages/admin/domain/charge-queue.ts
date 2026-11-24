import { whatsappNumber } from './charge-message';
import type { PatientMonthLine } from './finance';
import type { Patient } from './models';

/** Quem foi cobrada há menos de tantos dias fica fora do passo a passo. */
export const CHARGE_COOLDOWN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ChargeQueueItem {
  patientId: string;
  name: string;
  phone: string;
  /** Centavos: a receber do mês mais atrasos. */
  totalCents: number;
  chargedAt: Date | null;
  recentlyCharged: boolean;
}

export interface ChargeQueue {
  items: ChargeQueueItem[];
  invalidPhone: Array<{ patientId: string; name: string }>;
}

/**
 * Fila de cobrança do mês: pacientes cadastrados com atraso e telefone válido, em mês com sessões vinculadas.
 * Ordem: nunca cobradas, cobrança mais antiga, maior valor, nome. Cobradas recentemente vão para o fim.
 */
export function buildChargeQueue(input: {
  lines: PatientMonthLine[];
  patients: ReadonlyMap<string, Patient>;
  charges: ReadonlyMap<string, Date>;
  hasLinkedSessions: boolean;
  now: Date;
}): ChargeQueue {
  const queue: ChargeQueue = { items: [], invalidPhone: [] };
  if (!input.hasLinkedSessions) return queue;

  for (const line of input.lines) {
    const patient = input.patients.get(line.patientId);
    if (!patient || line.overdue <= 0) continue;
    if (whatsappNumber(patient.phone) === null) {
      queue.invalidPhone.push({ patientId: patient.id, name: patient.name });
      continue;
    }
    const chargedAt = input.charges.get(line.patientId) ?? null;
    queue.items.push({
      patientId: patient.id,
      name: patient.name,
      phone: patient.phone,
      totalCents: line.toReceive + line.overdue,
      chargedAt,
      recentlyCharged: chargedAt !== null && input.now.getTime() - chargedAt.getTime() < CHARGE_COOLDOWN_DAYS * DAY_MS,
    });
  }

  queue.items.sort((a, b) => {
    if (a.recentlyCharged !== b.recentlyCharged) return a.recentlyCharged ? 1 : -1;
    if ((a.chargedAt === null) !== (b.chargedAt === null)) return a.chargedAt === null ? -1 : 1;
    if (a.chargedAt && b.chargedAt && a.chargedAt.getTime() !== b.chargedAt.getTime()) {
      return a.chargedAt.getTime() - b.chargedAt.getTime();
    }
    if (a.totalCents !== b.totalCents) return b.totalCents - a.totalCents;
    return a.name.localeCompare(b.name);
  });
  return queue;
}
