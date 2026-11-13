const SESSION_MINUTES = 50;

// A descrição do evento não inclui e-mail nem texto livre do paciente (queixas):
// a agenda é lida por mais pessoas/serviços do que o necessário e a observação
// já chega à psicóloga pelo WhatsApp.
function buildBookingEvent({ service, date, time, name, phone }) {
  const slotStart = new Date(`${date}T${time}:00-03:00`);
  const slotEnd = new Date(slotStart.getTime() + SESSION_MINUTES * 60 * 1000);

  return {
    summary: `Consulta [${service}] - ${name}`,
    description:
      `Nova consulta agendada pelo site:\n\n` +
      `👤 Nome do Paciente: ${name}\n` +
      `📞 WhatsApp: ${phone}\n` +
      `🧩 Tipo de Sessão: ${service}`,
    start: { dateTime: slotStart.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: slotEnd.toISOString(), timeZone: 'America/Sao_Paulo' },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };
}

module.exports = { buildBookingEvent };
