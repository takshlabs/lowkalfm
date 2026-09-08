export function readSpectrum(value) {
  const empty = { available: false, bass: 0, mid: 0, treble: 0, level: 0 };
  if (!value || value.available !== true) return empty;
  const bands = ['bass', 'mid', 'treble', 'level'];
  if (!bands.every((key) => Number.isFinite(value[key]))) return empty;
  return Object.fromEntries([['available', true], ...bands.map((key) => [key, Math.min(1, Math.max(0, value[key]))])]);
}

export function visualFrame(signal, { playing = false, age = Infinity, still = false } = {}) {
  const frame = readSpectrum(playing && age < 1000 && !still ? signal : null);
  return { ...frame, pointerWeight: frame.available || still ? 0 : 1, mode: still ? 'still' : frame.available ? 'reactive' : 'ambient' };
}
