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
});
