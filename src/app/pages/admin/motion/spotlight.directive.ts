import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

import { canAnimateMotion } from './reduced-motion';

/** Holofote ambiente que acompanha o cursor no indicador (rAF-throttled, sem deslocar o card). */
@Directive({
  selector: '[appSpotlight]',
  standalone: true,
  host: {
    class: 'admin-spot',
    '(pointermove)': 'onMove($event)',
  },
})
export class SpotlightDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private frame = 0;
  private lastX = 0;
  private lastY = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    });
  }

  protected onMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' || !canAnimateMotion()) return;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const rect = this.host.getBoundingClientRect();
      this.host.style.setProperty('--mx', `${this.lastX - rect.left}px`);
      this.host.style.setProperty('--my', `${this.lastY - rect.top}px`);
    });
  }
}
