import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';

import { ZardButtonComponent } from '@/shared/components/button';
import { type CalendarValue } from '@/shared/components/calendar';
import { ZardDatePickerComponent } from '@/shared/components/date-picker';
import { ZardInputComponent } from '@/shared/components/input';
import { ZardSelectImports } from '@/shared/components/select';
import { ZardSeparatorComponent } from '@/shared/components/separator';
import {
  RescheduleService,
  type RescheduleConflict,
} from '../data/reschedule.service';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import { dateKeyOf, timeOf, zonedDateTime } from '../domain/datetime';
import type { ConfirmableStatus, Patient, Session } from '../domain/models';
import { BRT_OFFSET_MS, currentMonth, MONTH_ABBREVIATIONS } from '../domain/month';
import { canConfirm, canReschedule, formatShortDateTime } from '../domain/sessions-view';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_NAMES: readonly string[] = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayMonth(date: Date): string {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = MONTH_ABBREVIATIONS[local.getUTCMonth()];
  return `${day}/${month}`;
}

function buildRescheduleSuccessMessage(originalStartsAt: Date, newStartsAt: Date): string {
  const targetMonth = currentMonth(newStartsAt);
  const originalMonth = currentMonth(originalStartsAt);
  const monthIndex = Number(targetMonth.slice(5, 7)) - 1;
  const suffix = targetMonth !== originalMonth ? ` (em ${MONTH_NAMES[monthIndex]})` : '';
  return `Reagendada para ${formatShortDateTime(newStartsAt)}.${suffix}`;
}

/**
 * Ações de uma sessão (confirmar status, reagendar e trocar paciente), compartilhadas entre telas.
 *
 * O host usa `display: contents`, então o componente deve ficar dentro de um container
 * `flex flex-wrap`: os botões de status viram itens desse container e o bloco expandido
 * ocupa a linha inteira abaixo (`basis-full`).
 */
export type SessionActionMode = 'change' | 'reschedule';

@Component({
  selector: 'app-session-actions',
  standalone: true,
  imports: [
    ZardButtonComponent,
    ZardDatePickerComponent,
    ZardInputComponent,
    ZardSeparatorComponent,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar status da sessão">
      <button
        z-button
        [zType]="session().status === 'done' ? 'default' : 'outline'"
        [attr.aria-pressed]="session().status === 'done'"
        zSize="sm"
        type="button"
        [zDisabled]="!canChangeStatus() || disabled()"
        (click)="changeStatus('done')"
      >
        Realizada
      </button>
      <button
        z-button
        [zType]="session().status === 'no_show' ? 'default' : 'outline'"
        [attr.aria-pressed]="session().status === 'no_show'"
        zSize="sm"
        type="button"
        [zDisabled]="!canChangeStatus() || disabled()"
        (click)="changeStatus('no_show')"
      >
        Faltou
      </button>
      <button
        z-button
        [zType]="session().status === 'cancelled' ? 'default' : 'outline'"
        [attr.aria-pressed]="session().status === 'cancelled'"
        zSize="sm"
        type="button"
        [zDisabled]="!canChangeStatus() || disabled()"
        (click)="changeStatus('cancelled')"
      >
        Cancelada
      </button>
    </div>

    @if (hasPatient()) {
      <div class="basis-full space-y-3">
        @if (mode() === 'change') {
          <z-separator />
          <div class="flex flex-wrap items-end gap-2">
            <div class="space-y-1 grow max-w-xs">
              <label [attr.for]="'change-patient-' + session().id" class="block text-xs font-medium text-foreground">
                Trocar para
              </label>
              <z-select
                [id]="'change-patient-' + session().id"
                [zLabel]="'Trocar para'"
                zPlaceholder="Selecione um paciente..."
                class="w-full"
                [zValue]="changeSelection() ?? ''"
                (zSelectionChange)="selectChangePatient($any($event))"
              >
                @for (patient of changeOptions(); track patient.id) {
                  <z-select-item [zValue]="patient.id">{{ patient.name }}</z-select-item>
                }
              </z-select>
            </div>
            <button
              z-button
              zSize="sm"
              type="button"
              class="h-10 rounded-xl px-4"
              [zLoading]="working()"
              [zDisabled]="!changeSelection() || disabled()"
              (click)="saveChangePatient()"
            >
              Salvar
            </button>
            <button
              z-button
              zType="ghost"
              zSize="sm"
              type="button"
              class="h-10 rounded-xl px-4"
              [zDisabled]="disabled()"
              (click)="cancelChangePatient()"
            >
              Cancelar
            </button>
            <p class="w-full text-xs text-muted-foreground">
              O valor da sessão passa a seguir o acordo do novo paciente.
            </p>
          </div>
        } @else if (mode() === 'reschedule') {
          <z-separator />
          <div class="space-y-3">
            <div class="flex flex-wrap items-end gap-2">
              <div class="space-y-1 grow max-w-56">
                <label [attr.for]="'reschedule-date-' + session().id" class="block text-xs font-medium text-foreground">
                  Nova data
                </label>
                <z-date-picker
                  [zId]="'reschedule-date-' + session().id"
                  zLocale="pt-BR"
                  zFormat="dd/MM/yyyy"
                  zPlaceholder="Selecione a data"
                  zIcon="calendar"
                  [value]="rescheduleDate()"
                  (dateChange)="onRescheduleDateChange($event)"
                  class="w-full"
                />
              </div>

              <div class="space-y-1 w-32">
                <label [attr.for]="'reschedule-time-' + session().id" class="block text-xs font-medium text-foreground">
                  Novo horário
                </label>
                <input
                  z-input
                  [id]="'reschedule-time-' + session().id"
                  type="time"
                  class="h-10 rounded-xl bg-white"
                  [value]="rescheduleTime()"
                  (input)="onRescheduleTimeInput($any($event.target).value)"
                />
              </div>

              <button
                z-button
                zSize="sm"
                type="button"
                class="h-10 rounded-xl px-4"
                [zLoading]="working()"
                [zDisabled]="!canSubmitReschedule() || disabled()"
                (click)="submitReschedule(false)"
              >
                Reagendar
              </button>
              <button
                z-button
                zType="ghost"
                zSize="sm"
                type="button"
                class="h-10 rounded-xl px-4"
                [zDisabled]="disabled()"
                (click)="cancelReschedule()"
              >
                Cancelar
              </button>
              <p class="w-full text-xs text-muted-foreground">
                A sessão de {{ originalDayMonth() }} fica como Reagendada e não é cobrada. O evento no Google Agenda é movido.
              </p>
            </div>

            @if (conflicts().length > 0) {
              <div
                role="alert"
                class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-2"
              >
                <p class="font-medium">Já existe compromisso nesse horário:</p>
                <ul class="space-y-1">
                  @for (conflict of conflicts(); track $index) {
                    <li>• {{ conflict.title || 'Compromisso sem título' }} — {{ formatConflictRange(conflict) }}</li>
                  }
                </ul>
                <div class="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    z-button
                    zSize="sm"
                    type="button"
                    class="rounded-xl"
                    [zLoading]="working()"
                    [zDisabled]="disabled()"
                    (click)="submitReschedule(true)"
                  >
                    Reagendar mesmo assim
                  </button>
                  <button
                    z-button
                    zType="outline"
                    zSize="sm"
                    type="button"
                    class="rounded-xl"
                    [zDisabled]="disabled()"
                    (click)="dismissConflicts()"
                  >
                    Escolher outro horário
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="flex flex-wrap justify-end gap-1 -mt-1">
            @if (canRescheduleSession()) {
              <button
                z-button
                zType="ghost"
                zSize="sm"
                type="button"
                class="text-xs text-muted-foreground"
                [zDisabled]="disabled()"
                (click)="startReschedule()"
              >
                Reagendar
              </button>
            }
            <button
              z-button
              zType="ghost"
              zSize="sm"
              type="button"
              class="text-xs text-muted-foreground"
              [zDisabled]="disabled()"
              (click)="startChangePatient()"
            >
              Trocar paciente
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class SessionActionsComponent {
  private readonly sessionsService = inject(SessionsService);
  private readonly rescheduleService = inject(RescheduleService);

  readonly session = input.required<Session>();
  readonly patients = input.required<Patient[]>();
  /** Alguma gravação da tela está em andamento; trava as ações deste card. */
  readonly locked = input(false);

  /** Ação concluída: `null` para status e troca de paciente; a mensagem de sucesso nas ações que têm uma. */
  readonly done = output<string | null>();
  readonly failed = output<string>();
  /** Início (true) e fim (false) de uma gravação, para a tela travar as demais ações. */
  readonly workingChange = output<boolean>();

  readonly working = signal(false);
  /** Formulário aberto no card; volta a fechado quando a sessão do input muda. */
  readonly mode = linkedSignal<string, SessionActionMode | null>({
    source: () => this.session().id,
    computation: () => null,
  });
  readonly changeSelection = linkedSignal<string, string | null>({
    source: () => this.session().id,
    computation: () => null,
  });
  readonly rescheduleDateKey = linkedSignal<string, string>({
    source: () => this.session().id,
    computation: () => dateKeyOf(new Date(this.session().startsAt.getTime() + SEVEN_DAYS_MS)),
  });
  readonly rescheduleTime = linkedSignal<string, string>({
    source: () => this.session().id,
    computation: () => timeOf(this.session().startsAt),
  });
  readonly conflicts = linkedSignal<string, RescheduleConflict[]>({
    source: () => this.session().id,
    computation: () => [],
  });

  readonly disabled = computed(() => this.working() || this.locked());
  readonly hasPatient = computed(() => canConfirm(this.session()));
  readonly canChangeStatus = computed(() => this.hasPatient() && this.session().status !== 'rescheduled');
  readonly canRescheduleSession = computed(() => canReschedule(this.session()));
  readonly originalDayMonth = computed(() => formatDayMonth(this.session().startsAt));
  readonly rescheduleDate = computed(() => parseIsoDate(this.rescheduleDateKey()));
  readonly canSubmitReschedule = computed(
    () => Boolean(this.rescheduleDate()) && /^\d{2}:\d{2}$/.test(this.rescheduleTime()),
  );
  readonly changeOptions = computed(() =>
    this.patients().filter(p => p.active && p.id !== this.session().patientId),
  );

  async changeStatus(status: ConfirmableStatus): Promise<void> {
    if (!this.canChangeStatus()) return;
    const id = this.session().id;
    await this.run(() => this.sessionsService.setStatus(id, status));
  }

  startChangePatient(): void {
    this.changeSelection.set(null);
    this.conflicts.set([]);
    this.mode.set('change');
  }

  cancelChangePatient(): void {
    this.mode.set(null);
    this.changeSelection.set(null);
  }

  selectChangePatient(patientId: string): void {
    this.changeSelection.set(patientId);
  }

  async saveChangePatient(): Promise<void> {
    const patient = this.changeOptions().find(p => p.id === this.changeSelection());
    if (!patient) return;
    const id = this.session().id;
    await this.run(async () => {
      await this.sessionsService.changePatient(id, patient);
      this.cancelChangePatient();
    });
  }

  startReschedule(): void {
    if (!this.canRescheduleSession()) return;
    const startsAt = this.session().startsAt;
    this.rescheduleDateKey.set(dateKeyOf(new Date(startsAt.getTime() + SEVEN_DAYS_MS)));
    this.rescheduleTime.set(timeOf(startsAt));
    this.conflicts.set([]);
    this.mode.set('reschedule');
  }

  cancelReschedule(): void {
    this.mode.set(null);
    this.conflicts.set([]);
  }

  dismissConflicts(): void {
    this.conflicts.set([]);
  }

  onRescheduleDateChange(value: CalendarValue): void {
    const date = Array.isArray(value) ? (value[0] ?? null) : value instanceof Date ? value : null;
    if (!date) return;
    this.rescheduleDateKey.set(toIsoDate(date));
    this.conflicts.set([]);
  }

  onRescheduleTimeInput(value: string): void {
    this.rescheduleTime.set(value);
    this.conflicts.set([]);
  }

  protected formatConflictRange(conflict: RescheduleConflict): string {
    return `${formatDayMonth(conflict.startsAt)}, ${timeOf(conflict.startsAt)}–${timeOf(conflict.endsAt)}`;
  }

  async submitReschedule(force = false): Promise<void> {
    if (this.disabled() || !this.canRescheduleSession()) return;
    let targetStartsAt: Date;
    try {
      targetStartsAt = zonedDateTime(this.rescheduleDateKey(), this.rescheduleTime());
    } catch (err) {
      this.failed.emit(err instanceof Error ? err.message : 'Data/hora inválida.');
      return;
    }

    const session = this.session();
    this.working.set(true);
    this.workingChange.emit(true);
    try {
      const result = await this.rescheduleService.reschedule(session.id, targetStartsAt, force);
      if (result.kind === 'conflict') {
        this.conflicts.set(result.conflicts);
        return;
      }
      const message = buildRescheduleSuccessMessage(session.startsAt, result.startsAt);
      this.cancelReschedule();
      this.done.emit(message);
    } catch (err) {
      this.failed.emit(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.working.set(false);
      this.workingChange.emit(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.disabled()) return;
    this.working.set(true);
    this.workingChange.emit(true);
    try {
      await action();
      this.done.emit(null);
    } catch (err) {
      this.failed.emit(err instanceof Error ? err.message : SAVE_ERROR);
    } finally {
      this.working.set(false);
      this.workingChange.emit(false);
    }
  }
}
