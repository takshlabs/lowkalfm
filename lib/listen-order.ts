export function sortMixesByLatest<T extends { dateISO?: string }>(records: T[]) {
  return [...records].sort((left, right) => (right.dateISO || "").localeCompare(left.dateISO || ""));
}
