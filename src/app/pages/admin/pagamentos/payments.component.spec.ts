import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';

import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SAVE_ERROR } from '../data/safe-write';
import type { Patient, Payment } from '../domain/models';
import type { PaymentInput } from '../domain/payment-form';
import { PaymentFormComponent } from './payment-form.component';
import { PaymentsComponent } from './payments.component';

const activePatient: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: true },
};

const inactivePatient: Patient = { ...activePatient, id: 'p2', name: 'Carlos Inativo', active: false };

const pixAna: Payment = {
  id: 'pix-1',
  patientId: 'p1',
  amount: 15000,
  paidAt: '2026-11-27',
  referenceMonth: '2026-11',
  note: '',
};

const pixGone: Payment = { ...pixAna, id: 'pix-2', patientId: 'gone', amount: 20000, paidAt: '2026-11-20' };

describe('PaymentsComponent', () => {
  let paymentsSignal = signal<Payment[]>([]);
  let updateCalls: Array<{ id: string; input: PaymentInput }> = [];
  let createCalls: Array<{ id: string; input: PaymentInput }> = [];
  let queryParams: Record<string, string> = {};
  let createSave: () => Promise<void> = async () => {};
  let removeSave: () => Promise<void> = async () => {};
  let patientsLoaded = signal(true);

  beforeEach(() => {
    paymentsSignal = signal<Payment[]>([pixAna, pixGone]);
    updateCalls = [];
    createCalls = [];
    queryParams = {};
    createSave = async () => {};
    removeSave = async () => {};
    patientsLoaded = signal(true);

    const fakePayments: Pick<PaymentsService, 'payments' | 'error' | 'loaded' | 'newId' | 'create' | 'update' | 'remove'> = {
      payments: paymentsSignal.asReadonly(),
      error: signal<string | null>(null).asReadonly(),
      loaded: signal(true).asReadonly(),
      newId: () => 'new-pix',
      create: (id, input) => {
        createCalls.push({ id, input });
        return createSave();
      },
      update: async (id, input) => {
        updateCalls.push({ id, input });
      },
      remove: () => removeSave(),
    };

    const fakePatients: Pick<PatientsService, 'patients' | 'loaded' | 'error'> = {
      patients: signal<Patient[]>([activePatient, inactivePatient]).asReadonly(),
      loaded: patientsLoaded.asReadonly(),
      error: signal<string | null>(null).asReadonly(),
    };

    TestBed.configureTestingModule({
      imports: [PaymentsComponent],
      providers: [
        { provide: PaymentsService, useValue: fakePayments },
        { provide: PatientsService, useValue: fakePatients },
        {
          provide: ActivatedRoute,
          useFactory: () => ({ snapshot: { queryParamMap: convertToParamMap(queryParams) } }),
        },
      ],
    });
  });

  function textOf(fixture: ComponentFixture<PaymentsComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function paymentForm(fixture: ComponentFixture<PaymentsComponent>): PaymentFormComponent {
    return fixture.debugElement.query(By.directive(PaymentFormComponent)).componentInstance;
  }

  function selectValue(fixture: ComponentFixture<PaymentsComponent>, id: string): unknown {
    return fixture.debugElement.query(By.css(`#${id}`)).componentInstance.zValue();
  }

  function openedOptions(fixture: ComponentFixture<PaymentsComponent>, selector: string): string[] {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`${selector} [role="combobox"]`)?.click();
    fixture.detectChanges();
    return Array.from(document.querySelectorAll('[role="option"]')).map(o => o.textContent?.trim() ?? '');
  }

  function buttonWithText(fixture: ComponentFixture<PaymentsComponent>, text: string): HTMLButtonElement {
    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      b => b.textContent?.trim() === text,
    );
    if (!button) throw new Error(`Botão "${text}" não encontrado`);
    return button;
  }

  it('lista o Pix de paciente removido com "Paciente removido" e o de paciente inativo com o nome', () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    const content = textOf(fixture);
    expect(content).toContain('Ana Paula');
    expect(content).toContain('Paciente removido');

    const options = openedOptions(fixture, '#payment-filter-patient');
    expect(options).toContain('Carlos Inativo (inativo)');
  });

  it('edita o Pix de paciente removido sem exigir outro paciente', async () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    fixture.componentInstance.openEdit(pixGone);
    fixture.detectChanges();

    expect(selectValue(fixture, 'payment-patient')).toBe('gone');

    await paymentForm(fixture).submit(new Event('submit'));
    expect(updateCalls).toEqual([
      {
        id: 'pix-2',
        input: { patientId: 'gone', amount: 20000, paidAt: '2026-11-20', referenceMonth: '2026-11', note: '' },
      },
    ]);
  });

  it('rejeita data impossível antes de gravar e mostra a mensagem', async () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const form = paymentForm(fixture);
    form.patientId.set('p1');
    form.amount.set('150');
    form.setPaidAt('2026-02-31');
    await form.submit(new Event('submit'));
    fixture.detectChanges();

    expect(createCalls).toEqual([]);
    expect(textOf(fixture)).toContain('Data inválida. Use uma data real no formato AAAA-MM-DD.');
  });

  it('o mês de referência segue a data do Pix até a usuária alterá-lo', () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const form = paymentForm(fixture);
    form.setPaidAt('2026-10-05');
    expect(form.referenceMonth()).toBe('2026-10');

    form.setReferenceMonth('2026-09');
    form.setPaidAt('2026-11-02');
    expect(form.referenceMonth()).toBe('2026-09');
  });

  it('abre o formulário preenchido com os query params da Financeiro', () => {
    queryParams = { paciente: 'p1', mes: '2026-11', valor: '15000' };
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('#payment-amount')?.value).toBe('150,00');
    expect(paymentForm(fixture).referenceMonth()).toBe('2026-11');
    expect(selectValue(fixture, 'payment-patient')).toBe('p1');
  });

  it('não aplica o Pix de link de um paciente que não existe', async () => {
    queryParams = { paciente: 'p-inexistente', mes: '2026-11', valor: '15000' };
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('#payment-amount')?.value).toBe('');
    expect(selectValue(fixture, 'payment-patient')).toBe('');

    await paymentForm(fixture).submit(new Event('submit'));
    fixture.detectChanges();
    expect(createCalls).toEqual([]);
    expect(textOf(fixture)).toContain('Escolha o paciente.');
  });

  it('espera a lista de pacientes antes de abrir o Pix de link', () => {
    queryParams = { paciente: 'p1', mes: '2026-11', valor: '15000' };
    patientsLoaded.set(false);
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('#payment-amount')).toBeNull();

    patientsLoaded.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(selectValue(fixture, 'payment-patient')).toBe('p1');
    expect(root.querySelector<HTMLInputElement>('#payment-amount')?.value).toBe('150,00');
  });

  it('desabilita Confirmar enquanto outro Pix está sendo excluído', () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    fixture.componentInstance.askRemove(pixAna);
    fixture.componentInstance.busyId.set('pix-2');
    fixture.detectChanges();

    expect(buttonWithText(fixture, 'Confirmar').disabled).toBe(true);
  });

  it('mostra a falha do salvamento mesmo depois de Cancelar', async () => {
    let failSave: (error: Error) => void = () => {};
    createSave = () => new Promise<void>((_, reject) => (failSave = reject));
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const form = paymentForm(fixture);
    form.patientId.set('p1');
    form.amount.set('150');
    const saving = form.submit(new Event('submit'));
    buttonWithText(fixture, 'Cancelar').click();
    fixture.detectChanges();

    failSave(new Error(SAVE_ERROR));
    await saving;
    fixture.detectChanges();

    expect(textOf(fixture)).toContain(SAVE_ERROR);
  });

  it('mantém a falha de exclusão ao cancelar um formulário aberto', async () => {
    removeSave = async () => {
      throw new Error(SAVE_ERROR);
    };
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    fixture.componentInstance.askRemove(pixAna);
    await fixture.componentInstance.remove(pixAna);
    fixture.componentInstance.openEdit(pixGone);
    fixture.detectChanges();
    buttonWithText(fixture, 'Cancelar').click();
    fixture.detectChanges();

    expect(textOf(fixture)).toContain(SAVE_ERROR);
  });

  it('limpa a falha anterior quando o Pix é salvo na nova tentativa', async () => {
    createSave = async () => {
      throw new Error(SAVE_ERROR);
    };
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const form = paymentForm(fixture);
    form.patientId.set('p1');
    form.amount.set('150');
    await form.submit(new Event('submit'));
    fixture.detectChanges();
    expect(textOf(fixture)).toContain(SAVE_ERROR);

    createSave = async () => {};
    await form.submit(new Event('submit'));
    fixture.detectChanges();

    expect(textOf(fixture)).not.toContain(SAVE_ERROR);
  });

  it('em modo embedded oculta cabeçalho, filtra pelo mês externo e alterna para todos os meses', () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.componentRef.setInput('embedded', true);
    fixture.componentRef.setInput('externalMonth', '2026-11');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
    expect(fixture.componentInstance.visible().every(p => p.referenceMonth === '2026-11')).toBe(true);

    buttonWithText(fixture, 'Ver todos os meses').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.visible().length).toBeGreaterThanOrEqual(2);
  });
});
