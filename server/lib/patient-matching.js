function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findPatientForEvent(title, patients) {
  const normalizedTitle = normalizeText(title);
  const candidates = patients
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: normalizeText(p.name) }))
    .filter((p) => p.name && normalizedTitle.includes(p.name));

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  const longest = candidates.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  const containsAll = candidates.every((c) => c === longest || longest.name.includes(c.name));
  return containsAll ? longest.id : null;
}

function amountForNewSession(agreement) {
  return agreement && agreement.type === 'per_session' ? agreement.amount : 0;
}

module.exports = { normalizeText, findPatientForEvent, amountForNewSession };
