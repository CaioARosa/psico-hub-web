const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildBookingEvent } = require('./booking-event');

const booking = {
  service: 'Individual',
  date: '2026-11-16',
  time: '19:00',
  name: 'Maria Souza',
  phone: '(11) 91234-5678',
  email: 'maria@exemplo.com',
  message: 'Estou com ansiedade e problemas no casamento',
};

test('o título mantém o formato usado pelo vínculo com o paciente', () => {
  assert.equal(buildBookingEvent(booking).summary, 'Consulta [Individual] - Maria Souza');
});

test('a descrição não contém e-mail nem texto livre do paciente', () => {
  const { description } = buildBookingEvent(booking);
  assert.ok(!description.includes('maria@exemplo.com'));
  assert.ok(!description.includes('ansiedade'));
  assert.ok(!description.includes('casamento'));
});

test('a descrição mantém nome, telefone e tipo de sessão', () => {
  const { description } = buildBookingEvent(booking);
  assert.ok(description.includes('Maria Souza'));
  assert.ok(description.includes('(11) 91234-5678'));
  assert.ok(description.includes('Individual'));
});

test('horário em UTC-3 com duração de 50 minutos', () => {
  const event = buildBookingEvent(booking);
  assert.equal(event.start.dateTime, '2026-11-16T22:00:00.000Z');
  assert.equal(event.end.dateTime, '2026-11-16T22:50:00.000Z');
  assert.equal(event.start.timeZone, 'America/Sao_Paulo');
});

test('mantém lembretes de 24h por e-mail e 1h por popup', () => {
  const { reminders } = buildBookingEvent(booking);
  assert.equal(reminders.useDefault, false);
  assert.deepEqual(reminders.overrides, [
    { method: 'email', minutes: 1440 },
    { method: 'popup', minutes: 60 },
  ]);
});
