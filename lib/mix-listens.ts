/** Show only saved counts. An absent count is zero. */
export function getMixListenCount(_slug: string, baseline?: number) {
  return typeof baseline === "number" && Number.isSafeInteger(baseline) && baseline >= 0 ? baseline : 0;
}

export function formatMixListenCount(count: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}
