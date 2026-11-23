import { syncErrorMessage } from './calendar-sync-errors';

export function rescheduleErrorMessage(status: number, body?: unknown): string {
  if (status === 401 || status === 403) return syncErrorMessage(status);
  const serverMessage = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  return 'Falha ao reagendar. Tente novamente.';
}
