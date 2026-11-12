import { Injectable, inject, signal } from '@angular/core';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

import { FIREBASE_AUTH } from './firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly userState = signal<User | null>(null);
  readonly user = this.userState.asReadonly();

  private readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise<void>(resolve => {
      onAuthStateChanged(this.auth, user => {
        this.userState.set(user);
        resolve();
      });
    });
  }

  /** Resolve após o primeiro onAuthStateChanged, quando já se sabe se há sessão. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async getIdToken(): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }
    return user.getIdToken();
  }
}
