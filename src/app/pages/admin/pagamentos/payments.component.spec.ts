import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';

import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
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

  beforeEach(() => {
    paymentsSignal = signal<Payment[]>([pixAna, pixGone]);
    updateCalls = [];
    createCalls = [];
    queryParams = {};

    const fakePayments: Pick<PaymentsService, 'payments' | 'error' | 'loaded' | 'newId' | 'create' | 'update' | 'remove'> = {
      payments: paymentsSignal.asReadonly(),
      error: signal<string | null>(null).asReadonly(),
      loaded: signal(true).asReadonly(),
      newId: () => 'new-pix',
      create: async (id, input) => {
        createCalls.push({ id, input });
      },
      update: async (id, input) => {
        updateCalls.push({ id, input });
      },
      remove: async () => {},
    };

    const fakePatients: Pick<PatientsService, 'patients' | 'loaded' | 'error'> = {
      patients: signal<Patient[]>([activePatient, inactivePatient]).asReadonly(),
      loaded: signal(true).asReadonly(),
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

  it('lista o Pix de paciente removido com "Paciente removido" e o de paciente inativo com o nome', () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    const content = textOf(fixture);
    expect(content).toContain('Ana Paula');
    expect(content).toContain('Paciente removido');

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#payment-filter-patient option'),
    ).map(o => o.textContent?.trim());
    expect(options).toContain('Carlos Inativo (inativo)');
  });

  it('edita o Pix de paciente removido sem exigir outro paciente', async () => {
    const fixture = TestBed.createComponent(PaymentsComponent);
    fixture.detectChanges();

    fixture.componentInstance.openEdit(pixGone);
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#payment-patient');
    expect(select?.value).toBe('gone');

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
    expect(root.querySelector<HTMLInputElement>('#payment-reference-month')?.value).toBe('2026-11');
    expect(root.querySelector<HTMLSelectElement>('#payment-patient')?.value).toBe('p1');
  });
});
