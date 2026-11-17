import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PatientsService } from '../data/patients.service';
import { SAVE_ERROR } from '../data/safe-write';
import type { Patient } from '../domain/models';
import { PatientFormComponent } from './patient-form.component';
import { PatientsComponent } from './patients.component';

const activePatient: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: true },
};

describe('PatientsComponent', () => {
  let createSave: () => Promise<void> = async () => {};
  let setActiveSave: () => Promise<void> = async () => {};

  beforeEach(() => {
    createSave = async () => {};
    setActiveSave = async () => {};

    const fakePatients: Pick<PatientsService, 'patients' | 'loaded' | 'error' | 'newId' | 'create' | 'update' | 'setActive'> = {
      patients: signal([]).asReadonly(),
      loaded: signal(true).asReadonly(),
      error: signal<string | null>(null).asReadonly(),
      newId: () => 'new-patient',
      create: () => createSave(),
      update: async () => {},
      setActive: () => setActiveSave(),
    };

    TestBed.configureTestingModule({
      imports: [PatientsComponent],
      providers: [{ provide: PatientsService, useValue: fakePatients }],
    });
  });

  function buttonWithText(fixture: ComponentFixture<PatientsComponent>, text: string): HTMLButtonElement {
    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      b => b.textContent?.trim() === text,
    );
    if (!button) throw new Error(`Botão "${text}" não encontrado`);
    return button;
  }

  function openFilledForm(fixture: ComponentFixture<PatientsComponent>): PatientFormComponent {
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(PatientFormComponent)).componentInstance as PatientFormComponent;
    form.name.set('Ana Paula');
    form.phone.set('11999999999');
    form.amount.set('150');
    form.sessionsPerMonth.set('4');
    return form;
  }

  it('mostra a falha do salvamento mesmo depois de Cancelar', async () => {
    let failSave: (error: Error) => void = () => {};
    createSave = () => new Promise<void>((_, reject) => (failSave = reject));
    const fixture = TestBed.createComponent(PatientsComponent);
    const form = openFilledForm(fixture);

    const saving = form.submit(new Event('submit'));
    buttonWithText(fixture, 'Cancelar').click();
    fixture.detectChanges();

    failSave(new Error(SAVE_ERROR));
    await saving;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SAVE_ERROR);
  });

  it('mantém a falha de inativação ao cancelar um formulário aberto', async () => {
    setActiveSave = async () => {
      throw new Error(SAVE_ERROR);
    };
    const fixture = TestBed.createComponent(PatientsComponent);
    fixture.detectChanges();

    fixture.componentInstance.askDeactivate(activePatient);
    await fixture.componentInstance.setActive(activePatient, false);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    buttonWithText(fixture, 'Cancelar').click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SAVE_ERROR);
  });

  it('limpa a falha anterior quando o paciente é salvo na nova tentativa', async () => {
    createSave = async () => {
      throw new Error(SAVE_ERROR);
    };
    const fixture = TestBed.createComponent(PatientsComponent);
    const form = openFilledForm(fixture);
    await form.submit(new Event('submit'));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(SAVE_ERROR);

    createSave = async () => {};
    await form.submit(new Event('submit'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(SAVE_ERROR);
  });

  it('exibe microcopy apenas nos campos de acordo e mantém nome, telefone e valor limpos', async () => {
    const fixture = TestBed.createComponent(PatientsComponent);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = (root.textContent ?? '').replace(/\s+/g, ' ');

    expect(root.querySelector('#patient-name')?.getAttribute('aria-describedby')).toBeNull();
    expect(root.querySelector('#patient-phone')?.getAttribute('aria-describedby')).toBeNull();
    expect(root.querySelector('#patient-amount')?.getAttribute('aria-describedby')).toBeNull();

    expect(root.querySelector('#patient-type')?.getAttribute('aria-describedby')).toBe('patient-type-hint');
    expect(text).toContain(
      'Por sessão soma cada sessão realizada; pacote mensal cobra o valor fechado se houver sessão ativa no mês.',
    );

    expect(root.querySelector('#patient-sessions')?.getAttribute('aria-describedby')).toBe('patient-sessions-hint');
    expect(text).toContain(
      'Usado para calcular a receita prevista e avisar no Painel quando faltarem ou sobrarem sessões.',
    );

    expect(root.querySelector('#patient-charge-no-show')?.getAttribute('aria-describedby')).toBe(
      'patient-charge-no-show-hint',
    );
    expect(text).toContain(
      "Se ativo, sessões marcadas como 'Faltou' entram no valor devido (no acordo por sessão).",
    );

    const form = fixture.debugElement.query(By.directive(PatientFormComponent)).componentInstance as PatientFormComponent;
    await form.submit(new Event('submit'));
    fixture.detectChanges();

    expect(root.querySelector('#patient-sessions')?.getAttribute('aria-describedby')).toBe(
      'patient-sessions-hint patient-sessions-error',
    );
  });
});
