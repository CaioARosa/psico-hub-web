function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toWords(text) {
  return normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function containsWords(haystack, needle) {
  return ` ${haystack} `.includes(` ${needle} `);
}

function findPatientForEvent(title, patients) {
  const titleWords = toWords(title);
  const candidates = patients
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: toWords(p.name) }))
    .filter((p) => p.name && containsWords(titleWords, p.name));

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  const longest = candidates.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  const isHomonym = candidates.some((c) => c !== longest && c.name === longest.name);
  const containsAll = candidates.every((c) => c === longest || containsWords(longest.name, c.name));
  return containsAll && !isHomonym ? longest.id : null;
}

function amountForNewSession(agreement) {
  return agreement && agreement.type === 'per_session' ? agreement.amount : 0;
}

module.exports = { normalizeText, findPatientForEvent, amountForNewSession };
