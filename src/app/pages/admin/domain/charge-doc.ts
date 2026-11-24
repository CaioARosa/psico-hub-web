export interface Charge {
  patientId: string;
  /** `YYYY-MM`. */
  month: string;
  chargedAt: Date;
  /** Centavos inteiros: total cobrado (a receber do mês mais atrasos). */
  amount: number;
}

/** Formato do documento em `charges`. Não guarda o texto da mensagem (minimização, LGPD). */
export interface ChargeDoc {
  patientId: string;
  month: string;
  chargedAt: Date;
  amount: number;
}

/** Um documento por paciente e mês: marcar de novo atualiza a data, sem duplicar. */
export function chargeId(patientId: string, month: string): string {
  return `${patientId}_${month}`;
}

export function chargeToDoc(patientId: string, month: string, amount: number, chargedAt: Date): ChargeDoc {
  return { patientId, month, chargedAt, amount };
}

export function chargeFromDoc(data: Record<string, any>): Charge {
  const value = data['chargedAt'];
  const chargedAt = value && typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(0);
  return {
    patientId: String(data['patientId'] ?? ''),
    month: String(data['month'] ?? ''),
    chargedAt,
    amount: Number(data['amount'] ?? 0),
  };
}
