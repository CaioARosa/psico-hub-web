import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolve quando a promessa resolve a tempo', async () => {
    const result = withTimeout(Promise.resolve('ok'), 1000, new Error('tempo esgotado'));
    await expect(result).resolves.toBe('ok');
  });

  it('rejeita com o erro dado após ms quando a promessa nunca termina', async () => {
    const timeoutError = new Error('tempo esgotado');
    const result = withTimeout(new Promise<never>(() => undefined), 1000, timeoutError);
    const assertion = expect(result).rejects.toBe(timeoutError);

    await vi.advanceTimersByTimeAsync(999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('repassa a rejeição original quando a promessa falha a tempo', async () => {
    const original = new Error('permission-denied');
    const result = withTimeout(Promise.reject(original), 1000, new Error('tempo esgotado'));
    await expect(result).rejects.toBe(original);
  });

  it('não deixa timer pendente depois que a promessa termina', async () => {
    await withTimeout(Promise.resolve(1), 1000, new Error('x'));
    expect(vi.getTimerCount()).toBe(0);

    await withTimeout(Promise.reject(new Error('falha')), 1000, new Error('x')).catch(() => undefined);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignora a conclusão tardia da promessa depois do timeout', async () => {
    let resolveLate!: (value: string) => void;
    const late = new Promise<string>(resolve => (resolveLate = resolve));
    const timeoutError = new Error('tempo esgotado');
    const result = withTimeout(late, 1000, timeoutError);
    const assertion = expect(result).rejects.toBe(timeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    resolveLate('tarde');
    await vi.runAllTimersAsync();
  });
});
