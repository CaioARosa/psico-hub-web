import { matchesSearch, normalizeSearch } from './text';

describe('normalizeSearch', () => {
  it('ignora caixa, acentos e espaços nas pontas', () => {
    expect(normalizeSearch('  JOÃO  Conceição ')).toBe('joao conceicao');
  });
});

describe('matchesSearch', () => {
  it('encontra por trecho do nome sem acento nem caixa', () => {
    expect(matchesSearch('José Ávila', 'jose')).toBe(true);
    expect(matchesSearch('José Ávila', 'AVILA')).toBe(true);
    expect(matchesSearch('Maria Souza', 'ria sou')).toBe(true);
  });

  it('busca vazia encontra tudo; sem trecho correspondente não encontra', () => {
    expect(matchesSearch('Maria', '   ')).toBe(true);
    expect(matchesSearch('Maria', 'pedro')).toBe(false);
  });
});
