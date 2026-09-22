const MINIMUM_LISTEN_COUNT = 118;

/** Gives legacy mixes a stable, non-zero total until a verified baseline is in Sanity. */
export function getMixListenCount(slug: string, baseline?: number) {
  if (typeof baseline === "number" && Number.isFinite(baseline) && baseline > 0) return Math.round(baseline);
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return MINIMUM_LISTEN_COUNT + (hash % 760);
}

export function formatMixListenCount(count: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
