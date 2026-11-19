import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff } from '@ng-icons/lucide';

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
  imports: [NgIcon, ZardButtonComponent, ZardInputComponent, ZardAlertComponent, ...ZardCardImports],
  viewProviders: [provideIcons({ lucideEye, lucideEyeOff })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .login-stage {
        position: relative;
        overflow: hidden;
      }
      .login-stage::before {
        content: '';
        position: absolute;
        width: 42rem;
        height: 42rem;
        top: -16rem;
        right: -12rem;
        border-radius: 50%;
        background: radial-gradient(closest-side, rgb(212 230 225 / 0.52), transparent);
        pointer-events: none;
        animation: login-drift 18s ease-in-out infinite;
      }
      .login-card {
        position: relative;
        animation: login-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
      }
      .login-logo {
        animation: login-float 5.5s ease-in-out infinite;
      }
      .login-field {
        animation: login-rise 0.38s cubic-bezier(0.22, 1, 0.36, 1) backwards;
      }
      .login-field:nth-of-type(1) { animation-delay: 50ms; }
      .login-field:nth-of-type(2) { animation-delay: 100ms; }
      .login-error {
        animation: login-settle 0.38s cubic-bezier(0.22, 1, 0.36, 1) backwards;
      }
      @keyframes login-rise {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes login-drift {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(-28px, 22px); }
      }
      @keyframes login-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      @keyframes login-settle {
        0% { opacity: 0; transform: translateX(0); }
        25% { opacity: 1; transform: translateX(-3px); }
        55% { transform: translateX(2.5px); }
        80% { transform: translateX(-1.5px); }
        100% { transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .login-stage::before,
        .login-card,
        .login-logo,
        .login-field,
        .login-error {
          animation: none !important;
        }
      }
    `,
  ],
  template: `
    <main class="login-stage min-h-[100dvh] flex items-center justify-center px-5 py-10 bg-background">
      <z-card class="login-card w-full max-w-sm rounded-2xl p-6 shadow-sm">
        <form class="space-y-5" (submit)="submit($event)">
          <header class="text-center space-y-2">
            <img src="assets/tree-logo.png" alt="" class="login-logo w-9 h-9 object-contain mx-auto opacity-85" />
            <h1 class="font-display text-2xl text-foreground tracking-tight">Área administrativa</h1>
            <p class="text-sm text-muted-foreground font-light">Entre para gerenciar o consultório.</p>
          </header>

          <div class="login-field space-y-1.5">
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

          <div class="login-field space-y-1.5">
            <label for="password" class="block text-sm font-medium text-foreground">Senha</label>
            <div class="relative">
              <input
                z-input
                id="password"
                name="password"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
                required
                class="h-11 rounded-xl bg-white pr-10"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'"
                [attr.aria-pressed]="showPassword()"
                (click)="showPassword.set(!showPassword())"
              >
                <ng-icon [name]="showPassword() ? 'lucideEyeOff' : 'lucideEye'" class="size-4" />
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="login-error">
              <z-alert zType="destructive" zRole="alert" [zDescription]="error()!" />
            </div>
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
  readonly showPassword = signal(false);
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
