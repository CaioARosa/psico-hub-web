import { inject } from '@angular/core';
import { Router, type Params, type RedirectFunction } from '@angular/router';

export type LegacyAdminSegment = 'agenda' | 'sessoes' | 'painel' | 'cobranca' | 'pagamentos';

export interface RedirectTarget {
  commands: string[];
  queryParams: Record<string, string>;
}

function cleanStringParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  return out;
}

export function buildLegacyRedirect(segment: LegacyAdminSegment, rawParams: Params): RedirectTarget {
  const query = cleanStringParams(rawParams);

  switch (segment) {
    case 'agenda':
      return {
        commands: ['/admin/atendimentos'],
        queryParams: { ...query, aba: 'semana' },
      };

    case 'sessoes': {
      const legacyTab = query['aba'];
      const mappedTab =
        legacyTab === 'nao-identificados' || legacyTab === 'pendentes' ? 'pendencias' : 'mes';
      return {
        commands: ['/admin/atendimentos'],
        queryParams: { ...query, aba: mappedTab },
      };
    }

    case 'painel':
      return {
        commands: ['/admin/inicio'],
        queryParams: query,
      };

    case 'cobranca':
      return {
        commands: ['/admin/financeiro'],
        queryParams: { ...query, aba: 'cobrar' },
      };

    case 'pagamentos':
      return {
        commands: ['/admin/financeiro'],
        queryParams: { ...query, aba: 'pix' },
      };
  }
}

export function legacyRedirect(segment: LegacyAdminSegment): RedirectFunction {
  return info => {
    const target = buildLegacyRedirect(segment, info.queryParams);
    return inject(Router).createUrlTree(target.commands, { queryParams: target.queryParams });
  };
}
