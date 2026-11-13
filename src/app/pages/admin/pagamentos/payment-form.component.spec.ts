import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PatientsService } from '../data/patients.service';
import { PaymentsService } from '../data/payments.service';
import { SAVE_ERROR } from '../data/safe-write';
import type { Patient } from '../domain/models';
import { PaymentFormComponent } from './payment-form.component';

const activePatient: Patient = {
  id: 'p1',
  name: 'Ana Paula',
  phone: '11999999999',
  active: true,
  agreement: { type: 'per_session', amount: 15000, sessionsPerMonth: 4, chargeNoShow: true },
};

describe('PaymentFormComponent', () => {
  beforeEach(() => {
    const fakePayments: Pick<PaymentsService, 'newId' | 'create'> = {
      newId: () => 'new-pix',
      create: async () => {
        throw new Error(SAVE_ERROR);
      },
    };

    const fakePatients: Pick<PatientsService, 'patients' | 'loaded'> = {
      patients: signal<Patient[]>([activePatient]).asReadonly(),
      loaded: signal(true).asReadonly(),
    };

    TestBed.configureTestingModule({
      imports: [PaymentFormComponent],
      providers: [
        { provide: PaymentsService, useValue: fakePayments },
        { provide: PatientsService, useValue: fakePatients },
      ],
    });
  });

  it('avisa que o Pix pode ter sido salvo quando a criação falha', async () => {
    const fixture = TestBed.createComponent(PaymentFormComponent);
    fixture.componentRef.setInput('onFailed', () => {});
    fixture.detectChanges();

    const form = fixture.componentInstance;
    form.patientId.set('p1');
    form.amount.set('150,00');
    await form.submit(new Event('submit'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('O Pix pode ter sido salvo');
  });
});
