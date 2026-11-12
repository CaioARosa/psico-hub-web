const INVALID_CREDENTIALS = new Set([
  'auth/invalid-credential',
  'auth/invalid-email',
  'auth/user-not-found',
  'auth/wrong-password',
]);

export function loginErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code: unknown }).code
      : undefined;

  if (typeof code === 'string') {
    if (INVALID_CREDENTIALS.has(code)) return 'E-mail ou senha inválidos.';
    if (code === 'auth/too-many-requests') {
      return 'Muitas tentativas. Tente novamente em alguns minutos.';
    }
  }
  return 'Não foi possível entrar. Tente novamente.';
}
