import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardInputComponent } from '@/shared/components/input';
import { AuthService } from '../data/auth.service';
import { useNoIndex } from '../noindex';
import { loginErrorMessage } from './login-errors';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ZardButtonComponent, ZardInputComponent, ZardAlertComponent, ...ZardCardImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-[100dvh] flex items-center justify-center px-5 py-10 bg-background">
      <z-card class="w-full max-w-sm rounded-2xl p-6 shadow-sm animate-fade-in-up">
        <form class="space-y-5" (submit)="submit($event)">
          <header class="text-center space-y-2">
            <img src="assets/tree-logo.png" alt="" class="w-9 h-9 object-contain mx-auto opacity-85" />
            <h1 class="font-display text-2xl text-foreground tracking-tight">Área administrativa</h1>
            <p class="text-sm text-muted-foreground font-light">Entre para gerenciar o consultório.</p>
          </header>

          <div class="space-y-1.5">
            <label for="email" class="block text-sm font-medium text-foreground">E-mail</label>
            <input
              z-input
              id="email"
              name="email"
              type="email"
              autocomplete="username"
              required
              class="h-11 rounded-xl bg-white"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
            />
          </div>

          <div class="space-y-1.5">
            <label for="password" class="block text-sm font-medium text-foreground">Senha</label>
            <input
              z-input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="h-11 rounded-xl bg-white"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
            />
          </div>

          @if (error()) {
            <z-alert zType="destructive" zRole="alert" [zDescription]="error()!" />
          }

          <button z-button type="submit" zFull class="h-11 rounded-xl" [zLoading]="busy()" [zDisabled]="busy()">
            Entrar
          </button>
        </form>
      </z-card>
    </main>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    useNoIndex();
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email().trim(), this.password());
      await this.router.navigateByUrl('/admin');
    } catch (err) {
      this.error.set(loginErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
