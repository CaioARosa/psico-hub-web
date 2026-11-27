import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideExternalLink, lucideInfo } from '@ng-icons/lucide';

import { ZardAlertComponent } from '@/shared/components/alert';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardCardImports } from '@/shared/components/card';
import { ZardSkeletonComponent } from '@/shared/components/skeleton';
import { ZardTextareaComponent } from '@/shared/components/textarea';
import { ChargesService } from '../data/charges.service';
import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import { chargeMessage, whatsappLink } from '../domain/charge-message';
import { buildChargeQueue, CHARGE_COOLDOWN_DAYS, type ChargeQueueItem } from '../domain/charge-queue';
import { shortDateOf } from '../domain/datetime';
import { buildLedger, summarizeMonth } from '../domain/finance';
import { currentMonth, isValidMonth } from '../domain/month';
import { formatCents } from '../domain/money';
import { MonthPickerComponent } from '../month-picker.component';

@Component({
  selector: 'app-admin-cobranca',
  standalone: true,
  imports: [
    RouterLink,
    NgIcon,
    ZardAlertComponent,
    ZardButtonComponent,
    ZardSkeletonComponent,
    ZardTextareaComponent,
    MonthPickerComponent,
    ...ZardCardImports,
  ],
  viewProviders: [provideIcons({ lucideCheck, lucideExternalLink, lucideInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-6">
      @if (!embedded()) {
        <header class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="font-display text-3xl text-foreground tracking-tight">Cobrança</h1>
            <p class="text-xs text-muted-foreground mt-0.5">
              Uma paciente por vez. Você revisa a mensagem e envia pelo WhatsApp.
            </p>
          </div>

          <div class="space-y-1.5">
            <label for="cobranca-month" class="block text-sm font-medium text-foreground">Mês</label>
            <app-month-picker zId="cobranca-month" [month]="activeMonth()" (monthChange)="setMonth($event)" />
          </div>
        </header>
      }

      @if (loadError(); as message) {
        <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
      } @else if (!ready()) {
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">Carregando cobranças...</p>
          <z-skeleton class="h-56 w-full rounded-2xl" />
        </div>
      } @else {
        @if (!summary().hasLinkedSessions) {
          <z-alert
            zRole="status"
            zIcon="lucideInfo"
            class="bg-amber-50 border-amber-300/70 text-amber-950 rounded-xl"
            zDescription="Sem sessões vinculadas a pacientes neste mês. Sincronize a agenda e vincule os pacientes para cobrar."
          />
        }

        @if (current(); as item) {
          <z-card class="rounded-2xl shadow-2xs p-5 space-y-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 class="font-display text-2xl text-foreground">{{ item.name }}</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  @if (item.chargedAt) {
                    Última cobrança em {{ shortDate(item.chargedAt) }}.
                  } @else {
                    Ainda não cobrada neste mês.
                  }
                </p>
              </div>
              <div class="text-right">
                <p class="font-display text-2xl text-destructive tabular-nums">{{ formatCents(item.totalCents) }}</p>
                <p class="text-xs text-muted-foreground">Faltam {{ pending().length }} na fila</p>
              </div>
            </div>

            <div class="space-y-1.5">
              <label [attr.for]="'mensagem-' + item.patientId" class="block text-sm font-medium text-foreground">
                Mensagem
              </label>
              <textarea
                z-textarea
                [id]="'mensagem-' + item.patientId"
                rows="5"
                class="rounded-xl bg-white"
                [value]="textFor(item)"
                (input)="setDraft(item.patientId, $any($event.target).value)"
              ></textarea>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              @if (linkFor(item); as href) {
                <a
                  z-button
                  class="h-10 rounded-xl px-4"
                  [href]="href"
                  target="_blank"
                  rel="noopener noreferrer"
                  (click)="onOpened(item)"
                >
                  Abrir WhatsApp
                  <ng-icon name="lucideExternalLink" class="size-3.5" />
                </a>
              } @else {
                <button z-button type="button" class="h-10 rounded-xl px-4" [zDisabled]="true">Abrir WhatsApp</button>
              }
              <button z-button zType="outline" type="button" class="h-10 rounded-xl px-4" [zDisabled]="saving()" (click)="skip(item)">
                Pular
              </button>
            </div>

            @if (awaitingId() === item.patientId) {
              <div class="rounded-xl border border-[#4D6D66]/25 bg-[#D4E6E1]/45 p-4 space-y-3" role="group" aria-label="Confirmar envio">
                <p class="text-sm font-medium text-foreground">Enviou a mensagem?</p>
                <button
                  z-button
                  type="button"
                  class="h-10 rounded-xl px-4"
                  [zLoading]="saving()"
                  [zDisabled]="saving()"
                  (click)="confirmCharged(item)"
                >
                  Sim, marcar como cobrada
                </button>
              </div>
            }

            @if (error(); as message) {
              <z-alert zType="destructive" zRole="alert" [zDescription]="message" />
            }
          </z-card>
        } @else if (summary().hasLinkedSessions) {
          <z-alert
            zRole="status"
            zIcon="lucideCheck"
            class="bg-[#D4E6E1]/45 border-[#4D6D66]/25 text-foreground rounded-xl"
            [zDescription]="doneMessage()"
          />
        }

        @if (recent().length > 0) {
          <section class="space-y-2">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Cobradas há menos de {{ cooldownDays }} dias
            </h2>
            <ul class="bg-card rounded-2xl border border-border divide-y divide-border/70 shadow-2xs">
              @for (item of recent(); track item.patientId) {
                <li class="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span class="font-medium text-foreground">{{ item.name }}</span>
                  <span class="text-muted-foreground tabular-nums">
                    {{ formatCents(item.totalCents) }} · cobrada em {{ shortDate(item.chargedAt!) }}
                  </span>
                </li>
              }
            </ul>
          </section>
        }

        @if (queue().invalidPhone.length > 0) {
          <section class="space-y-2">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Sem WhatsApp válido</h2>
            <ul class="bg-card rounded-2xl border border-border divide-y divide-border/70 shadow-2xs">
              @for (item of queue().invalidPhone; track item.patientId) {
                <li class="px-4 py-3 text-sm">
                  <span class="font-medium text-foreground">{{ item.name }}</span>
                  <span class="text-amber-800"> · Telefone inválido. Corrija em </span>
                  <a routerLink="/admin/pacientes" class="text-primary underline underline-offset-4">Pacientes</a>.
                </li>
              }
            </ul>
          </section>
        }
      }
    </section>
  `,
})
export class CobrancaComponent {
  private readonly sessionsService = inject(SessionsService);
  private readonly patientsService = inject(PatientsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly chargesService = inject(ChargesService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly allSessions = this.sessionsService.watchAll();

  protected readonly formatCents = formatCents;
  protected readonly shortDate = shortDateOf;
  protected readonly cooldownDays = CHARGE_COOLDOWN_DAYS;

  readonly embedded = input(false);
  readonly externalMonth = input<string | null>(null);

  readonly month = signal(this.initialMonth());
  readonly activeMonth = computed(() => {
    const ext = this.externalMonth();
    return ext && isValidMonth(ext) ? ext : this.month();
  });
  readonly skipped = signal<ReadonlySet<string>>(new Set());
  readonly drafts = signal<Readonly<Record<string, string>>>({});
  /** Paciente cujo WhatsApp foi aberto e que aguarda a confirmação de envio. */
  readonly awaitingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private readonly chargesWatch = computed(() => this.chargesService.watchMonth(this.activeMonth()));

  constructor() {
    effect(() => {
      this.activeMonth();
      this.skipped.set(new Set());
      this.drafts.set({});
      this.awaitingId.set(null);
      this.error.set(null);
    });
  }

  readonly ready = computed(
    () =>
      this.allSessions.loaded() &&
      this.patientsService.loaded() &&
      this.paymentsService.loaded() &&
      this.chargesWatch().loaded(),
  );
  readonly loadError = computed(
    () =>
      this.allSessions.error() ??
      this.patientsService.error() ??
      this.paymentsService.error() ??
      this.chargesWatch().error(),
  );

  private readonly summary = computed(() =>
    summarizeMonth(
      buildLedger({
        patients: this.patientsService.patients(),
        sessions: this.allSessions.sessions(),
        payments: this.paymentsService.payments(),
      }),
      this.activeMonth(),
    ),
  );

  readonly queue = computed(() =>
    buildChargeQueue({
      lines: this.summary().lines,
      patients: new Map(this.patientsService.patients().map(patient => [patient.id, patient] as const)),
      charges: this.chargesWatch().charges(),
      hasLinkedSessions: this.summary().hasLinkedSessions,
      now: new Date(),
    }),
  );
  readonly pending = computed(() =>
    this.queue().items.filter(item => !item.recentlyCharged && !this.skipped().has(item.patientId)),
  );
  readonly current = computed(() => this.pending()[0] ?? null);
  readonly recent = computed(() => this.queue().items.filter(item => item.recentlyCharged));

  protected readonly doneMessage = computed(() =>
    this.queue().items.length === 0 && this.queue().invalidPhone.length === 0
      ? 'Ninguém em atraso neste mês.'
      : 'Fila concluída.',
  );

  private initialMonth(): string {
    const param = this.route?.snapshot?.queryParamMap?.get('mes') ?? null;
    return param && isValidMonth(param) ? param : currentMonth(new Date());
  }

  setMonth(value: string): void {
    if (!isValidMonth(value) || value === this.month()) return;
    this.month.set(value);
    this.skipped.set(new Set());
    this.drafts.set({});
    this.awaitingId.set(null);
    this.error.set(null);
  }

  textFor(item: ChargeQueueItem): string {
    return this.drafts()[item.patientId] ?? chargeMessage(item.name, item.totalCents);
  }

  setDraft(patientId: string, text: string): void {
    this.drafts.update(current => ({ ...current, [patientId]: text }));
  }

  protected linkFor(item: ChargeQueueItem): string | null {
    return whatsappLink(item.phone, this.textFor(item));
  }

  onOpened(item: ChargeQueueItem): void {
    this.error.set(null);
    this.awaitingId.set(item.patientId);
  }

  async confirmCharged(item: ChargeQueueItem): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.chargesService.markCharged(item.patientId, this.activeMonth(), item.totalCents);
      this.awaitingId.set(null);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.saving.set(false);
    }
  }

  skip(item: ChargeQueueItem): void {
    if (this.saving()) return;
    this.skipped.update(current => new Set(current).add(item.patientId));
    if (this.awaitingId() === item.patientId) this.awaitingId.set(null);
    this.error.set(null);
  }
}
