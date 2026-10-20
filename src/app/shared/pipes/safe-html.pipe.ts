import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Marca HTML estático e confiável (ex.: ícones SVG definidos no código) como seguro.
 * Sem isso, o sanitizer do Angular remove <svg> ao usar [innerHTML].
 * NUNCA use com conteúdo vindo do usuário ou de APIs.
 */
@Pipe({ name: 'safeHtml', standalone: true })
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
