import { withTimeout } from './with-timeout';

export const SAVE_ERROR = 'Não foi possível confirmar o salvamento. Verifique sua conexão e tente novamente.';
const WRITE_TIMEOUT_MS = 10_000;

/** Offline, as promessas de escrita do Firestore não terminam: o timeout vira erro repetível. */
export async function runWrite(operation: () => Promise<unknown>): Promise<void> {
  try {
    await withTimeout(operation(), WRITE_TIMEOUT_MS, new Error(SAVE_ERROR));
  } catch {
    throw new Error(SAVE_ERROR);
  }
}
