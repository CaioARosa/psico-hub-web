import type { Agreement, Session } from './models';
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
