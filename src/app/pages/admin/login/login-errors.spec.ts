import { loginErrorMessage } from './login-errors';

describe('loginErrorMessage', () => {
  it.each([
    'auth/invalid-credential',
    'auth/invalid-email',
    'auth/user-not-found',
    'auth/wrong-password',
  ])('mapeia %s para credenciais inválidas', code => {
    expect(loginErrorMessage({ code })).toBe('E-mail ou senha inválidos.');
  });

  it('mapeia auth/too-many-requests', () => {
    expect(loginErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      'Muitas tentativas. Tente novamente em alguns minutos.',
    );
  });

  it.each([{ code: 'auth/network-request-failed' }, new Error('x'), null, undefined, 'boom'])(
    'usa a mensagem genérica para erro desconhecido (%#)',
    err => {
      expect(loginErrorMessage(err)).toBe('Não foi possível entrar. Tente novamente.');
    },
  );
});
