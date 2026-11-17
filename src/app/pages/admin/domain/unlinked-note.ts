/** Sessões sem paciente ficam fora dos valores (spec §3); a nota diz quantas são. */
export function unlinkedNote(count: number): string {
  return count === 1
    ? '1 sessão sem paciente neste mês. Vincule-a na tela Sessões para entrar no cálculo.'
    : `${count} sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.`;
}
