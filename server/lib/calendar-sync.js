const { findPatientForEvent, amountForNewSession, packageAmountForNewSession } = require('./patient-matching');

const UTC_OFFSET_HOURS = 3;

function monthWindow(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month ?? ''));
  const monthIndex = match ? Number(match[2]) - 1 : -1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error('Mês inválido. Formato esperado: YYYY-MM.');
  }
  const year = Number(match[1]);
  return {
    start: new Date(Date.UTC(year, monthIndex, 1, UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1, UTC_OFFSET_HOURS)),
  };
}

function toTimedEvent(event, window) {
  if (!event || event.status === 'cancelled' || !event.start?.dateTime) return null;
  const startsAt = new Date(event.start.dateTime);
  if (Number.isNaN(startsAt.getTime())) return null;
  if (startsAt < window.start || startsAt >= window.end) return null;
  return { id: event.id, title: event.summary ?? '', startsAt };
}

function planSessionSync({ events, patients, existingSessions, window }) {
  const timedEvents = events.map((e) => toTimedEvent(e, window)).filter(Boolean);
  const existingById = new Map(existingSessions.map((s) => [s.id, s]));
  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const seenEventIds = new Set();
  const upserts = [];
  const summary = { created: 0, updated: 0, unidentified: 0, missing: 0 };

  for (const event of timedEvents) {
    seenEventIds.add(event.id);
    const existing = existingById.get(event.id);

    if (!existing) {
      const patientId = findPatientForEvent(event.title, patients);
      const agreement = patientId ? patientsById.get(patientId).agreement : null;
      upserts.push({
        id: event.id,
        data: {
          patientId,
          calendarEventId: event.id,
          startsAt: event.startsAt,
          calendarTitle: event.title,
          status: 'scheduled',
          amountApplied: amountForNewSession(agreement),
          packageAmountApplied: packageAmountForNewSession(agreement),
          missingFromCalendar: false,
        },
      });
      summary.created += 1;
      if (!patientId) summary.unidentified += 1;
      continue;
    }

    if (existing.status !== 'scheduled') continue;

    const data = { startsAt: event.startsAt, calendarTitle: event.title, missingFromCalendar: false };
    let resultingPatientId = existing.patientId ?? null;
    if (resultingPatientId === null) {
      const matched = findPatientForEvent(event.title, patients);
      if (matched) {
        const { agreement } = patientsById.get(matched);
        data.patientId = matched;
        data.amountApplied = amountForNewSession(agreement);
        data.packageAmountApplied = packageAmountForNewSession(agreement);
        resultingPatientId = matched;
      }
    }
    upserts.push({ id: event.id, data });
    summary.updated += 1;
    if (resultingPatientId === null) summary.unidentified += 1;
  }

  for (const session of existingSessions) {
    if (session.status === 'scheduled' && !seenEventIds.has(session.id)) {
      upserts.push({ id: session.id, data: { missingFromCalendar: true } });
      summary.missing += 1;
    }
  }

  return { upserts, summary };
}

async function syncMonth({ month, calendar, calendarId, repo, now = new Date() }) {
  const window = monthWindow(month);
  const response = await calendar.events.list({
    calendarId,
    timeMin: window.start.toISOString(),
    timeMax: window.end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
  });
  const events = response.data.items ?? [];
  const [patients, existingSessions] = await Promise.all([
    repo.listPatients(),
    repo.listSessionsBetween(window.start, window.end),
  ]);
  const { upserts, summary } = planSessionSync({ events, patients, existingSessions, window });
  await repo.applyUpserts(upserts);
  // Só depois das sessões gravadas: o painel usa esta hora para saber até quando as agendadas são confiáveis.
  await repo.recordSync(month, now);
  return summary;
}

module.exports = { monthWindow, planSessionSync, syncMonth };
