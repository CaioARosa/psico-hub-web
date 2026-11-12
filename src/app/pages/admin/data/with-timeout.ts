/** Rejeita com `error` se `promise` não terminar em `ms`; a rejeição original passa direto. */
export function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(error), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      reason => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}
