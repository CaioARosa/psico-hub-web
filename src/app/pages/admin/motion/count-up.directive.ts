import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

import { canAnimateMotion } from './reduced-motion';

const DURATION_MS = 480;
const EMPTY = '—';

/**
 * Anima o número de um indicador até o valor final. `null` mostra traço.
 * Sem animação (movimento reduzido, testes, sem rAF) o valor final é escrito direto.
 */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective {
  readonly value = input.required<number | null>({ alias: 'appCountUp' });
  readonly format = input.required<(value: number) => string>({ alias: 'countFormat' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private shown = 0;
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
    effect(() => this.render(this.value(), this.format()));
  }

  private render(target: number | null, format: (value: number) => string): void {
    this.cancel();
    if (target === null) {
      this.host.textContent = EMPTY;
      this.shown = 0;
      return;
    }

    const from = this.shown;
    if (from === target || !canAnimateMotion()) {
      this.host.textContent = format(target);
      this.shown = target;
      return;
    }

    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      this.shown = t === 1 ? target : from + (target - from) * (1 - Math.pow(1 - t, 4));
      this.host.textContent = format(Math.round(this.shown));
      if (t < 1) {
        this.frame = requestAnimationFrame(tick);
      } else {
        this.frame = 0;
      }
    };
    this.host.textContent = format(Math.round(from));
    this.frame = requestAnimationFrame(tick);
  }

  private cancel(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
