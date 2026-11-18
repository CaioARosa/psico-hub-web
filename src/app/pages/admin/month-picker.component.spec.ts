import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, beforeEach } from 'vitest';

import { ZardDatePickerComponent } from '@/shared/components/date-picker';
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
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function datePicker(): ZardDatePickerComponent {
    return fixture.debugElement.query(By.directive(ZardDatePickerComponent)).componentInstance;
  }

  it('mostra o mês recebido como o dia 1 selecionado', () => {
    const value = datePicker().value() as Date;

    expect(value.getFullYear()).toBe(2026);
    expect(value.getMonth()).toBe(10);
    expect(value.getDate()).toBe(1);
  });

  it('ao escolher qualquer dia, emite só o mês em YYYY-MM', () => {
    datePicker().dateChange.emit(new Date(2026, 9, 23, 12));

    expect(fixture.componentInstance.changes).toEqual(['2026-10']);
  });

  it('escolher um dia do mês já exibido não emite nada', () => {
    datePicker().dateChange.emit(new Date(2026, 10, 5, 12));

    expect(fixture.componentInstance.changes).toEqual([]);
  });

  it('um mês inválido não quebra o seletor e deixa o valor vazio', () => {
    fixture.componentInstance.month.set('');
    fixture.detectChanges();

    expect(datePicker().value()).toBeNull();
  });
});
