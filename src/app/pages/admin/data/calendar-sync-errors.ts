export function syncErrorMessage(status: number): string {
  if (status === 503) return 'Google Agenda não configurado.';
  if (status === 401 || status === 403) return 'Sessão expirada. Entre novamente.';
  return 'Falha ao sincronizar a agenda. Tente novamente.';
}
