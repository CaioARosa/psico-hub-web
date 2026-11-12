import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { AuthService } from './data/auth.service';
import { useNoIndex } from './noindex';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[100dvh]" style="background-color: #FDFBF7;">
      <header class="bg-white border-b border-[#4C645B]/15">
        <div class="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <nav aria-label="Administração" class="flex items-center gap-1">
            <a
              routerLink="/admin/pacientes"
              routerLinkActive="bg-[#D4E6E1]/60 text-[#1C221F]"
              class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#D4E6E1]/30"
            >Pacientes</a>
            <a
              routerLink="/admin/sessoes"
              routerLinkActive="bg-[#D4E6E1]/60 text-[#1C221F]"
              class="px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#D4E6E1]/30"
            >Sessões</a>
          </nav>
          <button z-button zType="outline" zSize="sm" type="button" (click)="logout()">Sair</button>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-5 py-6">
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
