/** Verifica preferência do usuário por movimento reduzido (seguro em SSR e testes). */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** True apenas em navegador real sem movimento reduzido (desliga animações JS em jsdom/Vitest). */
export function canAnimateMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    typeof requestAnimationFrame === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
