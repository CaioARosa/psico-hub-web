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
import { ZardSelectImports } from '@/shared/components/select';
import { ZardSeparatorComponent } from '@/shared/components/separator';
import { SAVE_ERROR } from '../data/safe-write';
import { SessionsService } from '../data/sessions.service';
import type { ConfirmableStatus, Patient, Session } from '../domain/models';
import { canConfirm } from '../domain/sessions-view';

/**
 * Ações de uma sessão (confirmar status e trocar paciente), compartilhadas entre telas.
 *
 * O host usa `display: contents`, então o componente deve ficar dentro de um container
 * `flex flex-wrap`: os botões de status viram itens desse container e o bloco de troca
 * ocupa a linha inteira abaixo (`basis-full`).
 */
export type SessionActionMode = 'change';

@Component({
  selector: 'app-session-actions',
  standalone: true,
  imports: [ZardButtonComponent, ZardSeparatorComponent, ...ZardSelectImports],
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
        } @else {
          <div class="flex justify-end -mt-1">
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

  readonly disabled = computed(() => this.working() || this.locked());
  readonly hasPatient = computed(() => canConfirm(this.session()));
  readonly canChangeStatus = computed(() => this.hasPatient() && this.session().status !== 'rescheduled');
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
