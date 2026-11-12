export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesSearch(name: string, query: string): boolean {
  const needle = normalizeSearch(query);
  return needle === '' || normalizeSearch(name).includes(needle);
}
