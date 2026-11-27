import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AdminMonthService } from '../data/admin-month.service';
import { AutoSyncService } from '../data/auto-sync.service';
import { PatientsService } from '../data/patients.service';
import { RescheduleService } from '../data/reschedule.service';
import { SessionsService, type AllSessionsWatch } from '../data/sessions.service';
import type { Patient, Session } from '../domain/models';
import { AtendimentosComponent } from './atendimentos.component';

const ana: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: true },
};

function makeSession(overrides: Partial<Session> & { id: string }): Session {
  return {
    patientId: 'p1',
    startsAt: new Date('2026-11-18T14:00:00.000Z'),
    calendarTitle: 'Consulta - Ana Paula',
    status: 'scheduled',
    amountApplied: 15000,
    packageAmountApplied: null,
    chargeNoShowApplied: null,
    missingFromCalendar: false,
    rescheduledToId: null,
    rescheduledToStartsAt: null,
    statusBeforeReschedule: null,
    rescheduledFromId: null,
    rescheduledFromStartsAt: null,
    ...overrides,
  };
}

describe('AtendimentosComponent', () => {
  let fixture: ComponentFixture<AtendimentosComponent>;
  let component: AtendimentosComponent;

  const month = signal('2026-11');
  const setMonth = vi.fn((value: string) => month.set(value));
  const sessions = signal<Session[]>([]);
  const patients = signal<Patient[]>([ana]);
  const linkPatient = vi.fn(async () => {});
  const setStatus = vi.fn(async () => {});
  const clearMissing = vi.fn(async () => {});
  const removeUnlinked = vi.fn(async () => {});
  const runAutoSync = vi.fn(async () => ({
    synced: [],
    skipped: [],
    totals: { created: 0, updated: 0, unidentified: 0, missing: 0 },
  }));

  async function setup(params: Record<string, string> = {}): Promise<void> {
    const watch: AllSessionsWatch = {
      sessions: sessions.asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    await TestBed.configureTestingModule({
      imports: [AtendimentosComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
        { provide: AdminMonthService, useValue: { month: month.asReadonly(), setMonth } },
        { provide: AutoSyncService, useValue: { run: runAutoSync, syncing: signal(false).asReadonly() } },
        { provide: PatientsService, useValue: { patients: patients.asReadonly(), loaded: signal(true).asReadonly() } },
        {
          provide: SessionsService,
          useValue: {
            watchAll: () => watch,
            linkPatient,
            setStatus,
            clearMissing,
            removeUnlinked,
            changePatient: vi.fn(async () => {}),
          },
        },
        { provide: RescheduleService, useValue: { reschedule: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AtendimentosComponent);
    component = fixture.componentInstance;
    component.now.set(new Date('2026-11-20T15:00:00.000Z'));
    component.goToDate(new Date('2026-11-20T15:00:00.000Z'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    month.set('2026-11');
    setMonth.mockClear();
    sessions.set([]);
    patients.set([ana]);
    linkPatient.mockClear();
    setStatus.mockClear();
    clearMissing.mockClear();
    removeUnlinked.mockClear();
    runAutoSync.mockClear();
  });

  it('abre na aba Semana com botão explícito de ações e vínculo inline para sessão sem paciente', async () => {
    sessions.set([
      makeSession({ id: 's-ok', patientId: 'p1', startsAt: new Date('2026-11-18T14:00:00.000Z') }),
      makeSession({ id: 's-unlinked', patientId: null, startsAt: new Date('2026-11-19T14:00:00.000Z'), calendarTitle: 'Consulta - Novo' }),
    ]);
    await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ana Paula');
    expect(text).toContain('Confirmar');
    expect(text).not.toContain('Resolver em Sessões');
    expect(text).toContain('Vincular');

    component.selectPatient('s-unlinked', 'p1');
    fixture.detectChanges();
    await component.linkSelectedPatient(sessions()[1]);

    expect(linkPatient).toHaveBeenCalledWith('s-unlinked', ana);
  });

  it('aba Pendências mostra sem paciente, passadas para confirmar e bloco de pendências do mês anterior', async () => {
    sessions.set([
      makeSession({ id: 's-unlinked', patientId: null, startsAt: new Date('2026-11-18T14:00:00.000Z') }),
      makeSession({ id: 's-past', patientId: 'p1', startsAt: new Date('2026-11-10T14:00:00.000Z') }),
      makeSession({ id: 's-prev-month', patientId: 'p1', startsAt: new Date('2026-10-22T14:00:00.000Z') }),
    ]);
    await setup({ aba: 'pendencias' });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sem paciente identificado');
    expect(text).toContain('Aguardando confirmação');
    expect(text).toContain('Restantes de out/26');
    expect(text).toContain('Realizada');
  });

  it('aba Pendências exibe estado tranquilo quando não há pendências', async () => {
    sessions.set([makeSession({ id: 's-done', status: 'done' })]);
    await setup({ aba: 'pendencias' });

    expect(fixture.nativeElement.textContent).toContain('Nenhuma pendência de atendimento');
  });

  it('aba Mês lista todas as sessões do mês ativo e sincroniza ?mes= no AdminMonthService', async () => {
    sessions.set([
      makeSession({ id: 's-oct', startsAt: new Date('2026-10-10T14:00:00.000Z'), missingFromCalendar: true }),
      makeSession({ id: 's-nov', startsAt: new Date('2026-11-10T14:00:00.000Z') }),
    ]);
    await setup({ aba: 'mes', mes: '2026-10' });

    expect(setMonth).toHaveBeenCalledWith('2026-10');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Removida do Agenda');
    expect(text).toContain('Manter');
  });
});
