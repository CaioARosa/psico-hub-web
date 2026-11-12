import { syncSummary } from './sync-summary';

describe('syncSummary', () => {
  it('descreve o resultado no plural', () => {
    expect(syncSummary({ created: 3, updated: 2, unidentified: 4, missing: 0 })).toBe(
      '3 novas, 2 atualizadas, 4 sem paciente, 0 removidas do Agenda',
    );
  });

  it('usa o singular para 1', () => {
    expect(syncSummary({ created: 1, updated: 1, unidentified: 1, missing: 1 })).toBe(
      '1 nova, 1 atualizada, 1 sem paciente, 1 removida do Agenda',
    );
  });

  it('zero é plural', () => {
    expect(syncSummary({ created: 0, updated: 0, unidentified: 0, missing: 0 })).toBe(
      '0 novas, 0 atualizadas, 0 sem paciente, 0 removidas do Agenda',
    );
  });
});
