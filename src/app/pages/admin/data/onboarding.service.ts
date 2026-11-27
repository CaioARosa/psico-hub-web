import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from './auth.service';

const STORAGE_PREFIX = 'psico-hub:onboarding:v1:';

function readDone(uid: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(`${STORAGE_PREFIX}${uid}`) === 'done';
  } catch {
    return false;
  }
}

function writeDone(uid: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${uid}`, 'done');
    }
  } catch {
    // Safari/iPad modo privado pode bloquear localStorage; segue apenas em memória.
  }
}

/** Controla o tutorial de boas-vindas guiado (exibe 1x por conta, sempre reabrível via "? Como funciona"). */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly auth = inject(AuthService);
  private readonly openState = signal(false);
  private readonly storageVersion = signal(0);
  private readonly completedInMemory = new Set<string>();

  readonly open = this.openState.asReadonly();

  readonly completed = computed(() => {
    this.storageVersion();
    const uid = this.auth.user()?.uid;
    if (!uid) return false;
    return this.completedInMemory.has(uid) || readDone(uid);
  });

  initForCurrentUser(): void {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    if (!this.completed()) {
      this.openState.set(true);
    }
  }

  openManual(): void {
    this.openState.set(true);
  }

  complete(): void {
    this.markFinished();
  }

  dismiss(): void {
    this.markFinished();
  }

  private markFinished(): void {
    const uid = this.auth.user()?.uid;
    if (uid) {
      this.completedInMemory.add(uid);
      writeDone(uid);
      this.storageVersion.update(v => v + 1);
    }
    this.openState.set(false);
  }
}
