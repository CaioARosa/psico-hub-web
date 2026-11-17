import { unlinkedNote } from './unlinked-note';

describe('unlinkedNote', () => {
  it('usa o singular para uma sessão', () => {
    expect(unlinkedNote(1)).toBe(
      '1 sessão sem paciente neste mês. Vincule-a na tela Sessões para entrar no cálculo.',
    );
  });

  it('usa o plural para duas ou mais sessões', () => {
    expect(unlinkedNote(2)).toBe(
      '2 sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.',
    );
    expect(unlinkedNote(5)).toBe(
      '5 sessões sem paciente neste mês. Vincule-as na tela Sessões para entrarem no cálculo.',
    );
  });
});
