import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertCircle, lucideRefreshCw, lucideX } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/shared/components/button';
import { AdminMonthService } from './data/admin-month.service';
import { AUTO_SYNC_ERROR, AutoSyncService } from './data/auto-sync.service';

/** Toast flutuante para falhas de sincronização do Google Agenda, sem bloquear o uso da tela. */
@Component({
  selector: 'app-sync-error-toast',
  standalone: true,
  imports: [NgIcon, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideAlertCircle, lucideRefreshCw, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleMessage(); as message) {
      <div
        role="alert"
        aria-live="assertive"
        class="admin-pane fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-2xl border border-red-200 bg-white p-4 shadow-lg"
      >
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <ng-icon name="lucideAlertCircle" class="size-4" />
          </div>

          <div class="min-w-0 flex-1 space-y-2.5">
            <div class="pr-6">
              <p class="text-sm font-semibold text-foreground">Falha ao sincronizar a agenda</p>
              <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">{{ message }}</p>
            </div>

            <div class="flex items-center gap-2">
              <button
                z-button
                zType="outline"
                zSize="sm"
                type="button"
                class="min-h-9 rounded-xl px-3 text-xs"
                [zLoading]="retrying()"
                [zDisabled]="retrying()"
                (click)="retry()"
              >
                @if (!retrying()) {
                  <ng-icon name="lucideRefreshCw" class="size-3.5" />
                }
                Tentar novamente
              </button>
            </div>
          </div>

          <button
            type="button"
            aria-label="Fechar aviso"
            (click)="dismiss()"
            class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ng-icon name="lucideX" class="size-4" />
          </button>
        </div>
      </div>
    }
  `,
})
export class SyncErrorToastComponent {
  private readonly autoSync = inject(AutoSyncService);
  private readonly adminMonth = inject(AdminMonthService);

  private readonly dismissedNonce = signal<number | null>(null);
  protected readonly retrying = signal(false);

  protected readonly visibleMessage = computed(() => {
    const message = this.autoSync.error();
    if (!message) return null;
    if (this.dismissedNonce() === this.autoSync.errorNonce()) return null;
    return message;
  });

  constructor() {
    effect(() => {
      const nonce = this.autoSync.errorNonce();
      if (this.dismissedNonce() !== null && this.dismissedNonce() !== nonce) {
        this.dismissedNonce.set(null);
      }
    });
  }

  protected dismiss(): void {
    this.dismissedNonce.set(this.autoSync.errorNonce());
  }

  protected async retry(): Promise<void> {
    if (this.retrying()) return;
    this.retrying.set(true);
    try {
      await this.adminMonth.syncCurrentMonthForce();
      this.autoSync.clearError();
      this.dismissedNonce.set(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : AUTO_SYNC_ERROR;
      this.autoSync.reportError(message);
    } finally {
      this.retrying.set(false);
    }
  }
}
