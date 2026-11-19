import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { provideZard } from '@/shared/core/provider/providezard';
import { MonthPickerComponent } from './month-picker.component';

@Component({
  imports: [MonthPickerComponent],
  template: `<app-month-picker zId="test-month" [month]="month()" (monthChange)="changes.push($event)" />`,
})
class HostComponent {
  readonly month = signal('2026-11');
  readonly changes: string[] = [];
}

describe('MonthPickerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideZard()] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#test-month');
  }

  async function open(): Promise<void> {
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function overlayButton(selector: string): HTMLButtonElement {
    return document.body.querySelector<HTMLButtonElement>(selector) as HTMLButtonElement;
  }

  it('mostra o mês recebido por extenso, sem dia', () => {
    expect(trigger().textContent).toContain('novembro de 2026');
  });

  it('um mês inválido mostra o placeholder', () => {
    fixture.componentInstance.month.set('');
    fixture.detectChanges();

    expect(trigger().textContent).toContain('Selecione o mês');
  });

  it('abre com os 12 meses do ano selecionado e sem dias', async () => {
    await open();

    expect(document.body.querySelectorAll('[data-month]').length).toBe(12);
    expect(overlayButton('[data-month="2026-11"]').getAttribute('aria-pressed')).toBe('true');
    expect(overlayButton('[data-month="2026-10"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('escolher um mês emite YYYY-MM', async () => {
    await open();

    overlayButton('[data-month="2026-03"]').click();

    expect(fixture.componentInstance.changes).toEqual(['2026-03']);
  });

  it('escolher o mês já exibido não emite nada', async () => {
    await open();

    overlayButton('[data-month="2026-11"]').click();

    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it('navega entre anos e emite o mês do outro ano', async () => {
    await open();

    overlayButton('[aria-label="Ano anterior"]').click();
    fixture.detectChanges();
    overlayButton('[data-month="2025-12"]').click();

    expect(fixture.componentInstance.changes).toEqual(['2025-12']);
  });
});


