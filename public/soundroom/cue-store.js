const prefix = 'lowkal.soundroom.cues.v1.';
const maxCues = 32;

function keyFor(slug) {
  return `${prefix}${encodeURIComponent(slug)}`;
}

export function readCues(storage, slug) {
  if (typeof slug !== 'string' || !slug || slug.length > 160) return [];
  try {
    const parsed = JSON.parse(storage.getItem(keyFor(slug)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, maxCues).filter((cue) => cue && typeof cue.id === 'string' && cue.id.length <= 100
      && Number.isFinite(cue.time) && cue.time >= 0 && cue.time <= 86400
      && typeof cue.label === 'string').map((cue) => ({
      id: cue.id, time: cue.time, label: cue.label.trim().slice(0, 80),
    })).sort((a, b) => a.time - b.time);
  } catch { return []; }
}

export function writeCues(storage, slug, cues) {
  if (typeof slug !== 'string' || !slug || slug.length > 160) return false;
  try {
    storage.setItem(keyFor(slug), JSON.stringify(cues.slice(0, maxCues)));
    return true;
  } catch { return false; }
}

export function addCue(cues, time, id) {
  if (!Number.isFinite(time) || time < 0 || time > 86400 || typeof id !== 'string' || !id) return cues;
  const rounded = Math.round(time * 10) / 10;
  if (cues.length >= maxCues || cues.some((cue) => Math.abs(cue.time - rounded) < 1)) return cues;
  return [...cues, { id, time: rounded, label: '' }].sort((a, b) => a.time - b.time);
}

export function renameCue(cues, id, label) {
  return cues.map((cue) => cue.id === id ? { ...cue, label: String(label).trim().slice(0, 80) } : cue);
}

export function removeCue(cues, id) {
  return cues.filter((cue) => cue.id !== id);
}
