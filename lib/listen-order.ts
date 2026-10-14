export function sortMixesByLatest<T extends { dateISO?: string }>(records: T[]) {
  return [...records].sort((left, right) => (right.dateISO || "").localeCompare(left.dateISO || ""));
}

export function sortMixesForPlacement<T extends { dateISO?: string; playerOrder?: number; soundroomOrder?: number; archiveOrder?: number; homeOrder?: number }>(records: T[], field: "playerOrder" | "soundroomOrder" | "archiveOrder" | "homeOrder") {
  // Keep the placement argument for existing callers. CMS positions cannot override dates.
  void field;
  return sortMixesByLatest(records);
}
