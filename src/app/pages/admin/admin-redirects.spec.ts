import { buildLegacyRedirect } from './admin-redirects';

describe('buildLegacyRedirect', () => {
  it('redireciona agenda para atendimentos?aba=semana preservando mes', () => {
    expect(buildLegacyRedirect('agenda', { mes: '2026-10' })).toEqual({
      commands: ['/admin/atendimentos'],
      queryParams: { aba: 'semana', mes: '2026-10' },
    });
  });

  it('mapeia sessoes nao-identificados e pendentes para pendencias e todas para mes', () => {
    expect(buildLegacyRedirect('sessoes', { mes: '2026-10', aba: 'nao-identificados' })).toEqual({
      commands: ['/admin/atendimentos'],
      queryParams: { mes: '2026-10', aba: 'pendencias' },
    });
    expect(buildLegacyRedirect('sessoes', { aba: 'pendentes' })).toEqual({
      commands: ['/admin/atendimentos'],
      queryParams: { aba: 'pendencias' },
    });
    expect(buildLegacyRedirect('sessoes', { aba: 'todas' })).toEqual({
      commands: ['/admin/atendimentos'],
      queryParams: { aba: 'mes' },
    });
    expect(buildLegacyRedirect('sessoes', {})).toEqual({
      commands: ['/admin/atendimentos'],
      queryParams: { aba: 'mes' },
    });
  });

  it('redireciona painel para inicio preservando mes', () => {
    expect(buildLegacyRedirect('painel', { mes: '2026-10' })).toEqual({
      commands: ['/admin/inicio'],
      queryParams: { mes: '2026-10' },
    });
  });

  it('redireciona cobranca para financeiro?aba=cobrar preservando mes', () => {
    expect(buildLegacyRedirect('cobranca', { mes: '2026-10' })).toEqual({
      commands: ['/admin/financeiro'],
      queryParams: { aba: 'cobrar', mes: '2026-10' },
    });
  });

  it('redireciona pagamentos para financeiro?aba=pix preservando prefill de Pix', () => {
    expect(buildLegacyRedirect('pagamentos', { paciente: 'p1', valor: '15000', mes: '2026-10' })).toEqual({
      commands: ['/admin/financeiro'],
      queryParams: { aba: 'pix', paciente: 'p1', valor: '15000', mes: '2026-10' },
    });
  });
});
