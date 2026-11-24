import { formatCents } from './money';

/** Normaliza telefone brasileiro para o formato exigido pelo `wa.me` (`55` + DDD + número). */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return null;
}

function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? '' : trimmed.split(/\s+/)[0];
}

/** Mensagem padrão de cobrança usando o primeiro nome do paciente e o total devido em BRL. */
export function chargeMessage(name: string, totalCents: number): string {
  return `Olá, ${firstName(name)}! Tudo bem? Passando para lembrar do valor em aberto das sessões: ${formatCents(totalCents)}. Quando fizer o Pix, pode me mandar o comprovante? Obrigada!`;
}

/** Monta o link `https://wa.me/...` com texto livre, ou `null` se o telefone for inválido ou o texto estiver vazio. */
export function whatsappLink(phone: string, text: string): string | null {
  const normalized = whatsappNumber(phone);
  if (!normalized || text.trim() === '') return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

/** Monta o link `https://wa.me/...` pronto para cobrança manual, ou `null` se faltar número, nome ou valor válido. */
export function whatsappChargeUrl(phone: string, name: string, totalCents: number): string | null {
  if (firstName(name) === '') return null;
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return null;
  return whatsappLink(phone, chargeMessage(name, totalCents));
}
