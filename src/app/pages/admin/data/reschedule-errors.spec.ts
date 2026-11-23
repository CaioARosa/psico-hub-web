import { syncErrorMessage } from './calendar-sync-errors';
import { rescheduleErrorMessage } from './reschedule-errors';

describe('rescheduleErrorMessage', () => {
  it('usa a mensagem do servidor quando presente', () => {
    expect(rescheduleErrorMessage(422, { error: 'Vincule um paciente antes de reagendar.' })).toBe(
      'Vincule um paciente antes de reagendar.',
    );
  });

  it('401 e 403 -> mesma mensagem de sessão expirada da sincronização', () => {
    expect(rescheduleErrorMessage(401)).toBe(syncErrorMessage(401));
    expect(rescheduleErrorMessage(403, { error: 'Acesso negado.' })).toBe(syncErrorMessage(403));
  });

  it('0 (sem conexão) -> falha genérica de reagendamento', () => {
    expect(rescheduleErrorMessage(0)).toBe('Falha ao reagendar. Tente novamente.');
  });

  it('sem corpo ou corpo inválido -> falha genérica', () => {
    expect(rescheduleErrorMessage(500)).toBe('Falha ao reagendar. Tente novamente.');
    expect(rescheduleErrorMessage(500, { error: '  ' })).toBe('Falha ao reagendar. Tente novamente.');
    expect(rescheduleErrorMessage(502, 'Bad Gateway' as never)).toBe(
      'Falha ao reagendar. Tente novamente.',
    );
  });
});
