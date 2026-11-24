import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/shared/components/button';
import { AuthService } from './data/auth.service';
import { AutoSyncService } from './data/auto-sync.service';
import { prefersReducedMotion } from './motion/reduced-motion';
import { useNoIndex } from './noindex';

interface PillBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ZardButtonComponent, NgIcon],
  viewProviders: [provideIcons({ lucideLogOut })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./motion/admin-shell.css', './motion/admin-motion.css'],
  template: `
    <div class="admin-root min-h-[100dvh] bg-background">
      <div #sentinel class="h-px -mb-px" aria-hidden="true"></div>
      <header
        class="admin-header sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-border"
        [class.is-scrolled]="scrolled()"
      >
        <div class="max-w-5xl mx-auto px-5 h-15 flex items-center justify-between gap-4">
          <div class="flex items-center gap-5 min-w-0">
            <a routerLink="/admin/painel" class="hidden sm:flex items-center gap-2 shrink-0">
              <img src="assets/tree-logo.png" alt="" class="admin-logo w-6 h-6 object-contain" />
              <span class="font-display text-base text-foreground">Consultório</span>
            </a>

            <nav
              #nav
              aria-label="Administração"
              class="admin-nav flex items-center gap-1 overflow-x-auto no-scrollbar py-1"
            >
              @if (pill(); as box) {
                <span
                  class="admin-nav-pill is-ready"
                  [class.is-instant]="instant()"
                  aria-hidden="true"
                  [style.width.px]="box.width"
                  [style.height.px]="box.height"
                  [style.transform]="'translate(' + box.x + 'px,' + box.y + 'px)'"
                ></span>
              }
              @for (link of links; track link.path) {
                <a
                  #el
                  [routerLink]="link.path"
                  routerLinkActive="admin-nav-active"
                  (isActiveChange)="$event && movePill(el)"
                  class="admin-nav-link px-3 py-1.5 rounded-lg text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
                >
                  {{ link.label }}
                </a>
              }
            </nav>
          </div>

          <button z-button zType="outline" zSize="sm" type="button" (click)="logout()" class="shrink-0">
            <ng-icon name="lucideLogOut" class="size-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-5 py-7">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  private readonly autoSync = inject(AutoSyncService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>('sentinel');
  private readonly nav = viewChild.required<ElementRef<HTMLElement>>('nav');

  protected readonly links = [
    { path: '/admin/agenda', label: 'Agenda' },
    { path: '/admin/painel', label: 'Painel' },
    { path: '/admin/pacientes', label: 'Pacientes' },
    { path: '/admin/sessoes', label: 'Sessões' },
    { path: '/admin/pagamentos', label: 'Pagamentos' },
    { path: '/admin/financeiro', label: 'Financeiro' },
    { path: '/admin/cobranca', label: 'Cobrança' },
  ];

  protected readonly scrolled = signal(false);
  protected readonly pill = signal<PillBox | null>(null);
  /** A primeira posição e os ajustes por redimensionamento não deslizam; só a troca de aba anima. */
  protected readonly instant = signal(true);

  private activeLink: HTMLElement | null = null;
  private rafId = 0;

  constructor() {
    useNoIndex();
    this.destroyRef.onDestroy(() => this.cancelRaf());

    afterNextRender(() => {
      void this.autoSync.runOnEntry();
      this.observeScroll();
      this.observeLayout();
    });
  }

  protected movePill(link: HTMLElement): void {
    const first = this.activeLink === null;
    this.activeLink = link;
    if (first) {
      this.instant.set(true);
      this.place(link);
      this.reenablePillTransition();
    } else {
      this.cancelRaf();
      this.instant.set(false);
      this.place(link);
    }
    this.revealInNav(link);
  }

  private place(link: HTMLElement): void {
    this.pill.set({
      x: link.offsetLeft,
      y: link.offsetTop,
      width: link.offsetWidth,
      height: link.offsetHeight,
    });
  }

  private reenablePillTransition(): void {
    this.cancelRaf();
    if (typeof requestAnimationFrame !== 'function') {
      this.instant.set(false);
      return;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = 0;
        this.instant.set(false);
      });
    });
  }

  private cancelRaf(): void {
    if (this.rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = 0;
  }

  /** Em telas estreitas a nav rola; mantém a aba ativa à vista. */
  private revealInNav(link: HTMLElement): void {
    const nav = this.nav().nativeElement;
    const left = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    nav.scrollTo({
      left: Math.max(0, left),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }

  private observeScroll(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => this.scrolled.set(!entry.isIntersecting));
    observer.observe(this.sentinel().nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** Fonte carregando ou janela redimensionada mudam a largura dos links; a pílula acompanha sem animar. */
  private observeLayout(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!this.activeLink) return;
      this.instant.set(true);
      this.place(this.activeLink);
      this.reenablePillTransition();
    });
    observer.observe(this.nav().nativeElement);
    this.nav()
      .nativeElement.querySelectorAll('a')
      .forEach(anchor => observer.observe(anchor));
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/admin/login');
  }
}
