import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';
import type { User } from 'firebase/auth';

import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

function setup(initialUser: User | null) {
  const user = signal<User | null>(null);
  let ready = false;
  const fakeAuth = {
    user,
    whenReady: () =>
      new Promise<void>(resolve =>
        setTimeout(() => {
          // O usuário só aparece depois do primeiro onAuthStateChanged.
          user.set(initialUser);
          ready = true;
          resolve();
        }, 0),
      ),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
  });
  return { isReady: () => ready };
}

function runGuard() {
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

describe('authGuard', () => {
  it('permite acesso quando há usuário', async () => {
    const { isReady } = setup({ uid: 'lays' } as User);

    const result = await runGuard();

    expect(isReady()).toBe(true);
    expect(result).toBe(true);
  });

  it('redireciona para /admin/login quando não há usuário', async () => {
    setup(null);

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/admin/login');
  });
});
