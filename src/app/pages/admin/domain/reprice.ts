import type { Agreement, Session, SessionStatus } from './models';
import { pricingForAgreement } from './money';

/** Valores que o reajuste grava em cada sessão `scheduled`; as demais ficam de fora. */
export function planReprice(
  sessions: Session[],
  agreement: Agreement,
): Array<{ id: string; amountApplied: number; packageAmountApplied: number }> {
  const pricing = pricingForAgreement(agreement);
  return sessions
    .filter(session => session.status === 'scheduled')
    .map(session => ({ id: session.id, ...pricing }));
}

/** Decide, dentro da transação, se a sessão ainda pode receber o reajuste: só `scheduled` e só se existir. */
export function decideRepriceWrite(
  current: { status: SessionStatus } | undefined,
  planned: { amountApplied: number; packageAmountApplied: number },
): { amountApplied: number; packageAmountApplied: number } | null {
  if (current?.status !== 'scheduled') return null;
  return { amountApplied: planned.amountApplied, packageAmountApplied: planned.packageAmountApplied };
}
