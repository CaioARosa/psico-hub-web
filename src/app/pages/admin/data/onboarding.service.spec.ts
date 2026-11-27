import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { User } from 'firebase/auth';
import { afterEach, vi } from 'vitest';

import { AuthService } from './auth.service';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const userState = signal<User | null>({ uid: 'user-a' } as User);

  function service(): OnboardingService {
    return TestBed.inject(OnboardingService);
  }

  beforeEach(() => {
    localStorage.clear();
    userState.set({ uid: 'user-a' } as User);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { user: userState.asReadonly() } }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('initForCurrentUser abre no primeiro acesso do uid e não reabre após complete', () => {
    const onboarding = service();

    onboarding.initForCurrentUser();
    expect(onboarding.open()).toBe(true);
    expect(onboarding.completed()).toBe(false);

    onboarding.complete();
    expect(onboarding.open()).toBe(false);
    expect(onboarding.completed()).toBe(true);

    onboarding.initForCurrentUser();
    expect(onboarding.open()).toBe(false);
  });

  it('dismiss persiste por uid e isola contas diferentes no mesmo aparelho', () => {
    const onboarding = service();
    onboarding.initForCurrentUser();
    onboarding.dismiss();

    expect(onboarding.open()).toBe(false);
    expect(onboarding.completed()).toBe(true);

    userState.set({ uid: 'user-b' } as User);
    expect(onboarding.completed()).toBe(false);
    onboarding.initForCurrentUser();
    expect(onboarding.open()).toBe(true);
  });

  it('openManual reabre o tutorial mesmo depois de concluído', () => {
    const onboarding = service();
    onboarding.complete();
    expect(onboarding.open()).toBe(false);

    onboarding.openManual();
    expect(onboarding.open()).toBe(true);
  });

  it('não lança exceção se localStorage estiver bloqueado (Safari modo privado)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const onboarding = service();
    expect(() => onboarding.initForCurrentUser()).not.toThrow();
    expect(onboarding.open()).toBe(true);
    expect(() => onboarding.dismiss()).not.toThrow();
    expect(onboarding.open()).toBe(false);
    onboarding.openManual();
    expect(onboarding.open()).toBe(true);
  });
});
