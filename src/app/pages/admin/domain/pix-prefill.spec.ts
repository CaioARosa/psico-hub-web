import { parsePixPrefill, pixPrefillQuery, prefillPatientExists } from './pix-prefill';

function params(values: Record<string, string>): { get(name: string): string | null } {
  return new URLSearchParams(values);
}

describe('parsePixPrefill', () => {
  it('lê paciente, mês e valor em centavos e devolve o valor em texto', () => {
    expect(parsePixPrefill(params({ paciente: 'p1', mes: '2026-11', valor: '15000' }))).toEqual({
      patientId: 'p1',
      referenceMonth: '2026-11',
      amount: '150,00',
    });
  });

  it.each([
    ['valor zero', { paciente: 'p1', mes: '2026-11', valor: '0' }],
    ['valor não numérico', { paciente: 'p1', mes: '2026-11', valor: 'abc' }],
    ['valor com decimal', { paciente: 'p1', mes: '2026-11', valor: '150,00' }],
    ['mês inválido', { paciente: 'p1', mes: '2026-13', valor: '15000' }],
    ['sem paciente', { mes: '2026-11', valor: '15000' }],
    ['paciente vazio', { paciente: '', mes: '2026-11', valor: '15000' }],
    ['sem mês', { paciente: 'p1', valor: '15000' }],
    ['sem valor', { paciente: 'p1', mes: '2026-11' }],
  ])('devolve null com %s', (_label, values) => {
    expect(parsePixPrefill(params(values))).toBeNull();
  });
});

describe('prefillPatientExists', () => {
  const prefill = { patientId: 'p1', referenceMonth: '2026-11', amount: '150,00' };

  it('aceita o paciente que existe na lista', () => {
    expect(prefillPatientExists(prefill, ['p2', 'p1'])).toBe(true);
  });

  it('recusa paciente que não existe na lista', () => {
    expect(prefillPatientExists(prefill, ['p2', 'p3'])).toBe(false);
  });

  it('recusa quando a lista de pacientes está vazia', () => {
    expect(prefillPatientExists(prefill, [])).toBe(false);
  });
});

describe('pixPrefillQuery', () => {
  it('gera paciente, mes e valor em centavos', () => {
    expect(pixPrefillQuery({ patientId: 'p1', month: '2026-11', toReceive: 15000 })).toEqual({
      paciente: 'p1',
      mes: '2026-11',
      valor: '15000',
    });
  });

  it('é a inversa de parsePixPrefill (ida e volta)', () => {
    const query = pixPrefillQuery({ patientId: 'p1', month: '2026-11', toReceive: 15050 });
    expect(parsePixPrefill(new URLSearchParams(query))).toEqual({
      patientId: 'p1',
      referenceMonth: '2026-11',
      amount: '150,50',
    });
  });
});
