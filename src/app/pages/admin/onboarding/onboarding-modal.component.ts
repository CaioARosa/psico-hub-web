import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCalendarCheck,
  lucideCheckCircle2,
  lucideRefreshCw,
  lucideUsers,
  lucideWallet,
  lucideX,
} from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardProgressComponent } from '@/shared/components/progress';
import { AdminMonthService } from '../data/admin-month.service';
import { AutoSyncService } from '../data/auto-sync.service';
import { OnboardingService } from '../data/onboarding.service';
import { PatientsService } from '../data/patients.service';
import { syncSummary } from '../domain/sync-summary';

@Component({
  selector: 'app-onboarding-modal',
  standalone: true,
  imports: [NgIcon, ZardAlertComponent, ZardButtonComponent, ZardProgressComponent],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCalendarCheck,
      lucideCheckCircle2,
      lucideRefreshCw,
      lucideUsers,
      lucideWallet,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (onboarding.open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-[#1C221F]/40 backdrop-blur-[2px] p-4"
        (click)="dismiss()"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          class="admin-pane relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-medium text-muted-foreground tabular-nums">
              Passo {{ step() }} de 4
            </span>
            <button
              type="button"
              aria-label="Fechar guia"
              (click)="dismiss()"
              class="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ng-icon name="lucideX" class="size-4" />
            </button>
          </div>

          <z-progress [value]="step() * 25" aria-hidden="true" class="h-1.5 bg-[#D4E6E1]/60" />

          @switch (step()) {
            @case (1) {
              <div class="space-y-4">
                <div>
                  <h2 id="onboarding-title" class="font-display text-2xl text-foreground tracking-tight">
                    Bem-vinda ao seu Consultório
                  </h2>
                  <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Em cerca de 2 minutos você entende o caminho completo do mês, sem precisar decorar onde cada coisa fica.
                  </p>
                </div>

                <ol class="space-y-2.5 text-sm">
                  <li class="flex items-start gap-3 rounded-xl bg-[#FDFBF7] border border-border/70 p-3">
                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#D4E6E1] text-xs font-semibold text-[#1C221F]">1</span>
                    <div>
                      <p class="font-medium text-foreground">Pacientes e acordos</p>
                      <p class="text-xs text-muted-foreground">Cadastre nomes e valores uma única vez.</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3 rounded-xl bg-[#FDFBF7] border border-border/70 p-3">
                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#D4E6E1] text-xs font-semibold text-[#1C221F]">2</span>
                    <div>
                      <p class="font-medium text-foreground">Agenda sincronizada sozinha</p>
                      <p class="text-xs text-muted-foreground">Suas sessões chegam do Google Agenda automaticamente.</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3 rounded-xl bg-[#FDFBF7] border border-border/70 p-3">
                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#D4E6E1] text-xs font-semibold text-[#1C221F]">3</span>
                    <div>
                      <p class="font-medium text-foreground">Confirmar atendimentos</p>
                      <p class="text-xs text-muted-foreground">Marque Realizada, Faltou ou vincule nomes pendentes.</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3 rounded-xl bg-[#FDFBF7] border border-border/70 p-3">
                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#D4E6E1] text-xs font-semibold text-[#1C221F]">4</span>
                    <div>
                      <p class="font-medium text-foreground">Receber e cobrar</p>
                      <p class="text-xs text-muted-foreground">Registre Pix e envie lembretes no WhatsApp em 1 toque.</p>
                    </div>
                  </li>
                </ol>
              </div>
            }

            @case (2) {
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#D4E6E1]/70 text-[#1C221F]">
                    <ng-icon name="lucideUsers" class="size-5" />
                  </div>
                  <div>
                    <h2 id="onboarding-title" class="font-display text-2xl text-foreground tracking-tight">
                      1. Cadastre seus pacientes
                    </h2>
                  </div>
                </div>

                <p class="text-sm text-muted-foreground leading-relaxed">
                  Use o <strong class="font-medium text-foreground">mesmo nome do Google Agenda</strong>. Assim o sistema reconhece cada sessão sozinho e calcula o valor certo pelo acordo (por sessão ou pacote mensal).
                </p>

                @if (activePatientsCount() > 0) {
                  <div class="flex items-center gap-2.5 rounded-xl border border-[#4D6D66]/25 bg-[#D4E6E1]/45 px-4 py-3 text-sm text-foreground">
                    <ng-icon name="lucideCheckCircle2" class="size-4 text-primary shrink-0" />
                    <span>
                      Você já tem <strong>{{ activePatientsCount() }}</strong>
                      {{ activePatientsCount() === 1 ? 'paciente ativo' : 'pacientes ativos' }} cadastrado{{ activePatientsCount() === 1 ? '' : 's' }}.
                    </span>
                  </div>
                } @else {
                  <div class="rounded-xl border border-border bg-[#FDFBF7] p-4 space-y-3">
                    <p class="text-sm text-foreground">Nenhum paciente ativo ainda. Comece por aqui:</p>
                    <button
                      z-button
                      type="button"
                      class="min-h-11 rounded-xl px-4"
                      (click)="goToNewPatient()"
                    >
                      Cadastrar primeiro paciente
                      <ng-icon name="lucideArrowRight" class="size-4" />
                    </button>
                  </div>
                }
              </div>
            }

            @case (3) {
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#D4E6E1]/70 text-[#1C221F]">
                    <ng-icon name="lucideCalendarCheck" class="size-5" />
                  </div>
                  <div>
                    <h2 id="onboarding-title" class="font-display text-2xl text-foreground tracking-tight">
                      2. Google Agenda automático
                    </h2>
                  </div>
                </div>

                <div class="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Ao abrir o sistema, ele já sincroniza sozinho o <strong class="font-medium text-foreground">mês passado, o mês atual e o próximo</strong> — e também atualiza automaticamente quando você escolhe outro mês no topo.
                  </p>
                  <p>
                    Você <strong class="font-medium text-foreground">não precisa clicar para sincronizar</strong> toda vez. O botão <span class="font-medium text-foreground">↻</span> no topo serve só se você acabou de alterar algo no Google Agenda agora.
                  </p>
                  <p>
                    Se algum evento vier com nome diferente do cadastro, ele aparece em <strong class="font-medium text-foreground">Atendimentos → Pendências</strong> para vincular em 1 toque.
                  </p>
                </div>

                <div class="rounded-xl border border-border bg-[#FDFBF7] p-4 space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-sm font-medium text-foreground">Quer testar a sincronização agora?</p>
                    <button
                      z-button
                      zType="outline"
                      type="button"
                      class="min-h-10 rounded-xl px-4"
                      [zLoading]="syncingNow()"
                      [zDisabled]="syncingNow()"
                      (click)="syncNow()"
                    >
                      @if (!syncingNow()) {
                        <ng-icon name="lucideRefreshCw" class="size-4" />
                      }
                      {{ syncingNow() ? 'Sincronizando...' : 'Sincronizar agora' }}
                    </button>
                  </div>

                  @if (syncFeedback(); as msg) {
                    <p class="text-xs text-primary font-medium">{{ msg }}</p>
                  }
                  @if (syncError(); as err) {
                    <z-alert zType="destructive" zRole="alert" [zDescription]="err" />
                  }
                </div>
              </div>
            }

            @case (4) {
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#D4E6E1]/70 text-[#1C221F]">
                    <ng-icon name="lucideWallet" class="size-5" />
                  </div>
                  <div>
                    <h2 id="onboarding-title" class="font-display text-2xl text-foreground tracking-tight">
                      3. Sua rotina em 2 gestos
                    </h2>
                  </div>
                </div>

                <ul class="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                  <li class="rounded-xl border border-border/70 bg-[#FDFBF7] p-3">
                    <strong class="font-medium text-foreground">Na semana (Atendimentos):</strong> marque cada sessão como <em>Realizada</em> ou <em>Faltou</em>. Isso libera o valor do mês.
                  </li>
                  <li class="rounded-xl border border-border/70 bg-[#FDFBF7] p-3">
                    <strong class="font-medium text-foreground">No fechamento (Financeiro):</strong> veja quem está em aberto, lance Pix ali mesmo ou cobre uma por vez no WhatsApp.
                  </li>
                  <li class="rounded-xl border border-border/70 bg-[#FDFBF7] p-3">
                    <strong class="font-medium text-foreground">Mês único no topo:</strong> mudou o mês uma vez, todas as abas acompanham. E sempre que quiser rever este guia, toque em <strong>? Como funciona</strong>.
                  </li>
                </ul>
              </div>
            }
          }

          <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/70">
            <button
              z-button
              zType="ghost"
              type="button"
              class="min-h-11 rounded-xl px-3 text-muted-foreground"
              (click)="dismiss()"
            >
              Pular e explorar
            </button>

            <div class="flex items-center gap-2">
              @if (step() > 1) {
                <button
                  z-button
                  zType="outline"
                  type="button"
                  class="min-h-11 rounded-xl px-4"
                  (click)="prev()"
                >
                  <ng-icon name="lucideArrowLeft" class="size-4" />
                  Voltar
                </button>
              }

              @if (step() < 4) {
                <button
                  z-button
                  type="button"
                  class="min-h-11 rounded-xl px-4"
                  (click)="next()"
                >
                  {{ step() === 1 ? 'Começar guia' : 'Próximo' }}
                  <ng-icon name="lucideArrowRight" class="size-4" />
                </button>
              } @else {
                <button
                  z-button
                  type="button"
                  class="min-h-11 rounded-xl px-4"
                  (click)="finish()"
                >
                  Ir para o Início
                  <ng-icon name="lucideArrowRight" class="size-4" />
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class OnboardingModalComponent {
  protected readonly onboarding = inject(OnboardingService);
  private readonly patientsService = inject(PatientsService);
  private readonly adminMonth = inject(AdminMonthService);
  private readonly router = inject(Router);
  protected readonly autoSync = inject(AutoSyncService);

  protected readonly step = signal(1);
  protected readonly syncingNow = signal(false);
  protected readonly syncFeedback = signal<string | null>(null);
  protected readonly syncError = signal<string | null>(null);

  protected readonly activePatientsCount = computed(
    () => this.patientsService.patients().filter(p => p.active).length,
  );

  constructor() {
    effect(() => {
      if (this.onboarding.open()) {
        this.step.set(1);
        this.syncFeedback.set(null);
        this.syncError.set(null);
      }
    });
  }

  protected onEscape(): void {
    if (this.onboarding.open()) this.dismiss();
  }

  protected prev(): void {
    this.step.update(s => Math.max(1, s - 1));
  }

  protected next(): void {
    this.step.update(s => Math.min(4, s + 1));
  }

  protected dismiss(): void {
    this.onboarding.dismiss();
  }

  protected goToNewPatient(): void {
    this.onboarding.complete();
    void this.router.navigate(['/admin/pacientes'], { queryParams: { novo: '1' } });
  }

  protected finish(): void {
    this.onboarding.complete();
    void this.router.navigate(['/admin/inicio']);
  }

  protected async syncNow(): Promise<void> {
    if (this.syncingNow()) return;
    this.syncingNow.set(true);
    this.syncFeedback.set(null);
    this.syncError.set(null);
    try {
      const outcome = await this.adminMonth.syncCurrentMonthForce();
      this.syncFeedback.set(syncSummary(outcome.totals));
    } catch (err) {
      this.syncError.set(
        err instanceof Error ? err.message : 'Falha ao sincronizar a agenda. Tente novamente.',
      );
    } finally {
      this.syncingNow.set(false);
    }
  }
}
