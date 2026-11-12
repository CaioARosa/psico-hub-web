import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { AuthService } from '../data/auth.service';
import { useNoIndex } from '../noindex';
import { loginErrorMessage } from './login-errors';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="min-h-[100dvh] flex items-center justify-center px-5 py-10" style="background-color: #FDFBF7;">
      <form
        class="w-full max-w-sm bg-white rounded-2xl border border-[#4C645B]/15 shadow-sm p-6 space-y-5"
        (submit)="submit($event)"
      >
        <header class="text-center">
          <h1 class="font-display text-2xl text-[#1C221F] tracking-tight">Área administrativa</h1>
          <p class="text-sm text-[#556661] font-light mt-1">Entre para gerenciar o consultório.</p>
        </header>

        <div class="space-y-1.5">
          <label for="email" class="text-sm font-medium text-[#1C221F]">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="username"
            required
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
          />
        </div>

        <div class="space-y-1.5">
          <label for="password" class="text-sm font-medium text-[#1C221F]">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full min-h-11 px-3 rounded-xl border border-[#4C645B]/20 bg-white text-[#1C221F] focus:outline-none focus:border-[#4D6D66]"
            [value]="password()"
            (input)="password.set($any($event.target).value)"
          />
        </div>

        @if (error()) {
          <p role="alert" class="text-sm text-red-700">{{ error() }}</p>
        }

        <button z-button type="submit" zFull [zLoading]="busy()" [zDisabled]="busy()">Entrar</button>
      </form>
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
