import { isValidMonth } from './month';
import { centsToInput } from './money';

export interface PixPrefill {
  patientId: string;
  referenceMonth: string;
  /** Valor em texto brasileiro (`150,00`), pronto para o campo do formulário. */
  amount: string;
}

export function parsePixPrefill(params: { get(name: string): string | null }): PixPrefill | null {
  const patientId = params.get('paciente') ?? '';
  const referenceMonth = params.get('mes') ?? '';
  const valor = params.get('valor') ?? '';

  if (patientId === '' || !isValidMonth(referenceMonth)) return null;
  if (!/^\d+$/.test(valor)) return null;
  const cents = Number(valor);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;

  return { patientId, referenceMonth, amount: centsToInput(cents) };
}

export function prefillPatientExists(prefill: PixPrefill, patientIds: string[]): boolean {
  return patientIds.includes(prefill.patientId);
}

export function pixPrefillQuery(line: {
  patientId: string;
  month: string;
  toReceive: number;
}): Record<string, string> {
  return { paciente: line.patientId, mes: line.month, valor: String(line.toReceive) };
}
