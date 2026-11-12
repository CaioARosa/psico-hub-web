import { DestroyRef, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

/** Marca a página atual como noindex e desfaz ao destruir o componente. Chamar em contexto de injeção. */
export function useNoIndex(): void {
  const meta = inject(Meta);
  const tag = meta.addTag({ name: 'robots', content: 'noindex' });
  inject(DestroyRef).onDestroy(() => {
    if (tag) meta.removeTagElement(tag);
  });
}
