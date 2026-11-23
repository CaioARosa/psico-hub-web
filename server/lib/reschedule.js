const { SESSION_MINUTES, SESSION_REMINDERS } = require('./booking-event');
const { RESCHEDULABLE_STATUSES } = require('./firestore-repo');

const TIME_ZONE = 'America/Sao_Paulo';
const SESSION_ID = /^[A-Za-z0-9_-]+$/;
// Sem offset explícito, o horário seria interpretado no fuso do servidor.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } });

function parseStartsAt(value) {
  if (typeof value !== 'string' || !ISO_WITH_OFFSET.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isGone(error) {
  const status = error?.code ?? error?.status ?? error?.response?.status;
  return status === 404 || status === 410;
}

async function loadEventTemplate({ calendar, calendarId, session }) {
  try {
    const { data } = await calendar.events.get({ calendarId, eventId: session.id });
    const start = new Date(data.start?.dateTime);
    const end = new Date(data.end?.dateTime);
    const durationMs = end - start;
    return {
      summary: data.summary,
      ...(data.description !== undefined && { description: data.description }),
      reminders: data.reminders ?? SESSION_REMINDERS,
      durationMs: durationMs > 0 ? durationMs : SESSION_MINUTES * 60 * 1000,
    };
  } catch (error) {
    if (!isGone(error)) throw error;
    return {
      summary: session.calendarTitle,
      reminders: SESSION_REMINDERS,
      durationMs: SESSION_MINUTES * 60 * 1000,
    };
  }
}

async function findConflicts({ calendar, calendarId, originalId, start, end }) {
  const { data } = await calendar.events.list({
    calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
  });
  return (data.items ?? [])
    .filter((e) => e.id !== originalId && e.status !== 'cancelled' && e.start?.dateTime)
    .map((e) => ({
      title: e.summary ?? '',
      startsAt: new Date(e.start.dateTime).toISOString(),
      endsAt: new Date(e.end?.dateTime ?? e.start.dateTime).toISOString(),
    }));
}

async function deleteEventQuietly({ calendar, calendarId, eventId }) {
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (error) {
    if (!isGone(error)) console.error(`Error deleting calendar event ${eventId}:`, error);
  }
}

async function rescheduleSession({ sessionId, startsAt, force, calendar, calendarId, repo }) {
  if (!calendar) return fail(503, 'Google Agenda não configurado.');
  // Datas passadas são aceitas de propósito: permite registrar uma remarcação esquecida.
  const newStart = parseStartsAt(startsAt);
  if (!newStart) return fail(400, 'Data/hora inválida.');
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return fail(404, 'Sessão não encontrada.');

  try {
    const session = await repo.getSession(sessionId);
    if (!session) return fail(404, 'Sessão não encontrada.');
    if (!session.patientId) return fail(422, 'Vincule um paciente antes de reagendar.');
    if (!RESCHEDULABLE_STATUSES.has(session.status)) return fail(409, 'Esta sessão não pode ser reagendada.');
    if (session.startsAt?.getTime() === newStart.getTime()) {
      return fail(400, 'Escolha uma data/hora diferente da atual.');
    }

    const { durationMs, ...template } = await loadEventTemplate({ calendar, calendarId, session });
    const newEnd = new Date(newStart.getTime() + durationMs);

    if (!force) {
      const conflicts = await findConflicts({ calendar, calendarId, originalId: session.id, start: newStart, end: newEnd });
      if (conflicts.length > 0) return fail(409, 'Já existe compromisso nesse horário.', { conflicts });
    }

    const { data: inserted } = await calendar.events.insert({
      calendarId,
      requestBody: {
        ...template,
        start: { dateTime: newStart.toISOString(), timeZone: TIME_ZONE },
        end: { dateTime: newEnd.toISOString(), timeZone: TIME_ZONE },
      },
    });
    const newId = inserted.id;

    try {
      await repo.commitReschedule({
        originalId: session.id,
        newId,
        newData: {
          patientId: session.patientId,
          calendarEventId: newId,
          startsAt: newStart,
          calendarTitle: session.calendarTitle ?? null,
          status: 'scheduled',
          amountApplied: session.amountApplied ?? null,
          packageAmountApplied: session.packageAmountApplied ?? null,
          chargeNoShowApplied: null,
          missingFromCalendar: false,
          rescheduledFromId: session.id,
          rescheduledFromStartsAt: session.startsAt,
        },
        originalUpdate: {
          status: 'rescheduled',
          rescheduledToId: newId,
          rescheduledToStartsAt: newStart,
        },
      });
    } catch (error) {
      await deleteEventQuietly({ calendar, calendarId, eventId: newId });
      if (error?.code === 'NOT_RESCHEDULABLE') return fail(409, 'Esta sessão não pode ser reagendada.');
      throw error;
    }

    await deleteEventQuietly({ calendar, calendarId, eventId: session.id });
    return { status: 200, body: { newSessionId: newId, startsAt: newStart.toISOString() } };
  } catch (error) {
    console.error('Error rescheduling session:', error);
    return fail(500, 'Falha ao reagendar. Tente novamente.');
  }
}

module.exports = { rescheduleSession };
