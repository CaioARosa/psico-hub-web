const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeText, findPatientForEvent, amountForNewSession } = require('./patient-matching');

const patient = (id, name, active = true) => ({ id, name, active });

test('normalizeText remove acento, caixa e espaços duplicados', () => {
  assert.equal(normalizeText('  JOSÉ   Antônio '), 'jose antonio');
});

test('casa título do site', () => {
  const patients = [patient('p1', 'Maria Souza'), patient('p2', 'João Lima')];
  assert.equal(findPatientForEvent('Consulta [Individual] - Maria Souza', patients), 'p1');
});

test('ignora acento e caixa', () => {
  const patients = [patient('p1', 'JOSE')];
  assert.equal(findPatientForEvent('Consulta - josé', patients), 'p1');
});

test('retorna null sem casamento', () => {
  const patients = [patient('p1', 'Maria Souza')];
  assert.equal(findPatientForEvent('Almoço com a família', patients), null);
});

test('retorna null para ambiguidade real', () => {
  const patients = [patient('p1', 'Ana Lima'), patient('p2', 'Ana Souza')];
  assert.equal(findPatientForEvent('Consulta - Ana Lima e Ana Souza', patients), null);
});

test('nomes contidos: vence o mais longo', () => {
  const patients = [patient('p1', 'Ana'), patient('p2', 'Ana Paula')];
  assert.equal(findPatientForEvent('Consulta [Casal] - Ana Paula', patients), 'p2');
});

test('ignora pacientes inativos', () => {
  const patients = [patient('p1', 'Maria Souza', false)];
  assert.equal(findPatientForEvent('Consulta - Maria Souza', patients), null);
});

test('amountForNewSession: per_session devolve o valor do acordo', () => {
  assert.equal(amountForNewSession({ type: 'per_session', amount: 15000 }), 15000);
});

test('amountForNewSession: monthly_package devolve 0', () => {
  assert.equal(amountForNewSession({ type: 'monthly_package', amount: 60000 }), 0);
});

test('amountForNewSession: sem acordo devolve 0', () => {
  assert.equal(amountForNewSession(null), 0);
});
