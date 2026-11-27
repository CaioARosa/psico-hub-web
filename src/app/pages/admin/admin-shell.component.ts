import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideCircleHelp,
  lucideLogOut,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/shared/components/button';
import { AdminMonthService } from './data/admin-month.service';
import { AuthService } from './data/auth.service';
import { AUTO_SYNC_ERROR, AutoSyncService } from './data/auto-sync.service';
import { ChargesService } from './data/charges.service';
import { OnboardingService } from './data/onboarding.service';
import { PatientsService } from './data/patients.service';
import { PaymentsService } from './data/payments.service';
import { SessionsService } from './data/sessions.service';
import { buildLedger, summarizeMonth } from './domain/finance';
import { syncedAgoLabel } from './domain/sync-freshness';
import { buildWorkflowState } from './domain/workflow';
import { MonthPickerComponent } from './month-picker.component';
import { prefersReducedMotion } from './motion/reduced-motion';
import { useNoIndex } from './noindex';
import { OnboardingModalComponent } from './onboarding/onboarding-modal.component';
import { SyncErrorToastComponent } from './sync-error-toast.component';

interface PillBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NavItem {
  path: string;
  label: string;
  badgeKey?: 'atendimentos' | 'financeiro';
}

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ZardButtonComponent,
    NgIcon,
    MonthPickerComponent,
    OnboardingModalComponent,
    SyncErrorToastComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideLogOut,
      lucideCircleHelp,
      lucideChevronLeft,
      lucideChevronRight,
      lucideRefreshCw,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./motion/admin-shell.css', './motion/admin-motion.css'],
  template: `
    <div class="admin-root min-h-[100dvh] bg-background">
      <div #sentinel class="h-px -mb-px" aria-hidden="true"></div>
      <header
        class="admin-header sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border"
        [class.is-scrolled]="scrolled()"
      >
        <div class="max-w-5xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <div class="flex items-center gap-4 min-w-0">
            <a routerLink="/admin/inicio" class="hidden md:flex items-center gap-2 shrink-0">
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
                  class="admin-nav-link inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 rounded-xl text-sm font-medium text-[#556661] hover:bg-[#F5F2ED] hover:text-[#1C221F] transition-colors whitespace-nowrap"
                >
                  <span>{{ link.label }}</span>
                  @if (badgeFor(link.badgeKey); as count) {
                    <span
                      class="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[#4D6D66] px-1.5 text-[11px] font-semibold text-white tabular-nums"
                    >
                      {{ count }}
                    </span>
                  }
                </a>
              }
            </nav>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button
              z-button
              zType="ghost"
              zSize="sm"
              type="button"
              aria-label="Como funciona"
              (click)="onboarding.openManual()"
              class="min-h-10 rounded-xl px-2.5 sm:px-3 text-[#556661] hover:text-[#1C221F]"
            >
              <ng-icon name="lucideCircleHelp" class="size-4" />
              <span class="hidden sm:inline">Como funciona</span>
            </button>

            <button
              z-button
              zType="outline"
              zSize="sm"
              type="button"
              (click)="logout()"
              class="min-h-10 rounded-xl px-3"
            >
              <ng-icon name="lucideLogOut" class="size-3.5" />
              <span class="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        @if (showMonthBar()) {
          <div
            data-testid="admin-month-bar"
            class="border-t border-border/70 bg-[#FDFBF7]/90"
          >
            <div class="max-w-5xl mx-auto px-4 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  z-button
                  zType="outline"
                  zSize="icon-sm"
                  type="button"
                  aria-label="Mês anterior"
                  class="size-10 rounded-xl bg-white"
                  (click)="adminMonth.shift(-1)"
                >
                  <ng-icon name="lucideChevronLeft" class="size-4" />
                </button>

                <app-month-picker
                  zId="admin-active-month"
                  [month]="adminMonth.month()"
                  (monthChange)="adminMonth.setMonth($event)"
                />

                <button
                  z-button
                  zType="outline"
                  zSize="icon-sm"
                  type="button"
                  aria-label="Próximo mês"
                  class="size-10 rounded-xl bg-white"
                  (click)="adminMonth.shift(1)"
                >
                  <ng-icon name="lucideChevronRight" class="size-4" />
                </button>

                @if (!adminMonth.isCurrentMonth()) {
                  <button
                    z-button
                    zType="ghost"
                    zSize="sm"
                    type="button"
                    class="min-h-10 rounded-xl px-3 text-xs font-medium text-primary"
                    (click)="adminMonth.resetToCurrent()"
                  >
                    Mês atual
                  </button>
                }
              </div>

              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                @if (autoSync.syncing() || forcingSync()) {
                  <span role="status" class="inline-flex items-center gap-1.5">
                    <ng-icon name="lucideRefreshCw" class="size-3.5 animate-spin text-primary" />
                    Atualizando agenda…
                  </span>
                } @else if (syncedAgo(); as ago) {
                  <span>Agenda atualizada {{ ago }}</span>
                } @else {
                  <span>Google Agenda conectado</span>
                }

                <button
                  z-button
                  zType="ghost"
                  zSize="icon-sm"
                  type="button"
                  aria-label="Atualizar agenda agora"
                  title="Atualizar agenda agora"
                  class="size-9 rounded-xl text-muted-foreground hover:text-foreground"
                  [zDisabled]="autoSync.syncing() || forcingSync()"
                  (click)="forceRefresh()"
                >
                  <ng-icon name="lucideRefreshCw" class="size-3.5" [class.animate-spin]="forcingSync()" />
                </button>
              </div>
            </div>
          </div>
        }
      </header>

      <main class="max-w-5xl mx-auto px-4 sm:px-5 py-6 sm:py-7">
        <router-outlet />
      </main>

      <app-onboarding-modal />
      <app-sync-error-toast />
    </div>
  `,
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);
  protected readonly autoSync = inject(AutoSyncService);
  protected readonly adminMonth = inject(AdminMonthService);
  protected readonly onboarding = inject(OnboardingService);
  private readonly patientsService = inject(PatientsService);
  private readonly sessionsService = inject(SessionsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly chargesService = inject(ChargesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>('sentinel');
  private readonly nav = viewChild.required<ElementRef<HTMLElement>>('nav');

  private readonly allSessions = this.sessionsService.watchAll();
  private readonly currentUrl = signal(this.router.url);
  protected readonly forcingSync = signal(false);

  protected readonly links: readonly NavItem[] = [
    { path: '/admin/inicio', label: 'Início' },
    { path: '/admin/atendimentos', label: 'Atendimentos', badgeKey: 'atendimentos' },
    { path: '/admin/financeiro', label: 'Financeiro', badgeKey: 'financeiro' },
    { path: '/admin/pacientes', label: 'Pacientes' },
  ];

  protected readonly showMonthBar = computed(() => !this.currentUrl().startsWith('/admin/pacientes'));

  protected readonly syncedAgo = computed(() => {
    const syncedAt = this.autoSync.lastSyncedAt();
    return syncedAt ? syncedAgoLabel(syncedAt, new Date()) : null;
  });

  private readonly workflow = computed(() => {
    const month = this.adminMonth.month();
    const patients = this.patientsService.patients();
    const sessions = this.allSessions.sessions();
    const payments = this.paymentsService.payments();
    const ledger = buildLedger({ patients, sessions, payments });
    const summary = summarizeMonth(ledger, month);
    const charges = this.chargesService.watchMonth(month).charges();
    return buildWorkflowState({
      patients,
      sessions,
      summary,
      charges,
      month,
      now: new Date(),
      syncing: this.autoSync.syncing(),
      lastSyncedAt: this.autoSync.lastSyncedAt(),
    });
  });

  protected readonly scrolled = signal(false);
  protected readonly pill = signal<PillBox | null>(null);
  /** A primeira posição e os ajustes por redimensionamento não deslizam; só a troca de aba anima. */
  protected readonly instant = signal(true);

  private activeLink: HTMLElement | null = null;
  private rafId = 0;

  constructor() {
    useNoIndex();
    this.destroyRef.onDestroy(() => this.cancelRaf());

    const navSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
      }
    });
    this.destroyRef.onDestroy(() => navSub.unsubscribe());

    afterNextRender(() => {
      void this.autoSync.runOnEntry();
      this.onboarding.initForCurrentUser();
      this.observeScroll();
      this.observeLayout();
    });
  }

  protected badgeFor(key: NavItem['badgeKey']): number {
    if (!key) return 0;
    const state = this.workflow();
    return key === 'atendimentos' ? state.atendimentosBadge : state.financeiroBadge;
  }

  protected async forceRefresh(): Promise<void> {
    if (this.forcingSync() || this.autoSync.syncing()) return;
    this.forcingSync.set(true);
    try {
      await this.adminMonth.syncCurrentMonthForce();
      this.autoSync.clearError();
    } catch (err) {
      this.autoSync.reportError(err instanceof Error ? err.message : AUTO_SYNC_ERROR);
    } finally {
      this.forcingSync.set(false);
    }
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
    if (typeof nav.scrollTo !== 'function') return;
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
