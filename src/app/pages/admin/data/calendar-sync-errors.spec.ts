import { syncErrorMessage } from './calendar-sync-errors';

describe('syncErrorMessage', () => {
  it('503 -> Google Agenda não configurado', () => {
    expect(syncErrorMessage(503)).toBe('Google Agenda não configurado.');
  });

  it('401 e 403 -> sessão expirada', () => {
    expect(syncErrorMessage(401)).toBe('Sessão expirada. Entre novamente.');
    expect(syncErrorMessage(403)).toBe('Sessão expirada. Entre novamente.');
  });

  it('demais status (inclusive 0 de rede) -> falha genérica', () => {
    for (const status of [0, 400, 500, 502]) {
      expect(syncErrorMessage(status)).toBe('Falha ao sincronizar a agenda. Tente novamente.');
    }
  });
});
