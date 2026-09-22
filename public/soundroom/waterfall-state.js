export function readWaterfallBins(value) {
  if (!value || value.available !== true || !Array.isArray(value.bins) || value.bins.length !== 48
    || !value.bins.every(Number.isFinite)) return null;
  return value.bins.map((level) => Math.min(1, Math.max(0, level)));
}
