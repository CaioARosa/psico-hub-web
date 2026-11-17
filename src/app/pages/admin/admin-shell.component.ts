import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/shared/components/button';
import { AuthService } from './data/auth.service';
import { useNoIndex } from './noindex';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ZardButtonComponent, NgIcon],
  viewProviders: [provideIcons({ lucideLogOut })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[100dvh] bg-background">
      <header class="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-border">
        <div class="max-w-5xl mx-auto px-5 h-15 flex items-center justify-between gap-4">
          <div class="flex items-center gap-5 min-w-0">
            <a routerLink="/admin/painel" class="hidden sm:flex items-center gap-2 shrink-0 group">
              <img src="assets/tree-logo.png" alt="" class="w-6 h-6 object-contain group-hover:scale-105 transition-transform" />
              <span class="font-display text-base text-foreground">Consultório</span>
            </a>

            <nav aria-label="Administração" class="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
              <a
                routerLink="/admin/painel"
                routerLinkActive="bg-[#D4E6E1]/70 text-[#1C221F] shadow-2xs"
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
              >
                Painel
              </a>
              <a
                routerLink="/admin/pacientes"
                routerLinkActive="bg-[#D4E6E1]/70 text-[#1C221F] shadow-2xs"
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
              >
                Pacientes
              </a>
              <a
                routerLink="/admin/sessoes"
                routerLinkActive="bg-[#D4E6E1]/70 text-[#1C221F] shadow-2xs"
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
              >
                Sessões
              </a>
              <a
                routerLink="/admin/pagamentos"
                routerLinkActive="bg-[#D4E6E1]/70 text-[#1C221F] shadow-2xs"
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
              >
                Pagamentos
              </a>
              <a
                routerLink="/admin/financeiro"
                routerLinkActive="bg-[#D4E6E1]/70 text-[#1C221F] shadow-2xs"
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
              >
                Financeiro
              </a>
            </nav>
          </div>

          <button z-button zType="outline" zSize="sm" type="button" (click)="logout()" class="shrink-0">
            <ng-icon name="lucideLogOut" class="size-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-5 py-7 animate-fade-in">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    useNoIndex();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/admin/login');
  }
}
