import { addCue, readCues, removeCue, renameCue, writeCues } from './cue-store.js';

const addButton = document.getElementById('cue-add');
const list = document.getElementById('cue-list');
const status = document.getElementById('cue-status');
let playback = null;
let visibleSlug = '';
let lastRevision = -1;

function timeLabel(seconds) {
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = String(value % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function persist(cues) {
  if (!writeCues(window.localStorage, visibleSlug, cues)) {
    status.textContent = 'This browser could not save cue points.';
    return false;
  }
  render();
  return true;
}

function render() {
  const cues = readCues(window.localStorage, visibleSlug);
  list.replaceChildren();
  const ready = playback?.slug === visibleSlug && playback.isReady === true && Number.isFinite(playback.currentTime)
    && Number.isFinite(playback.duration) && playback.duration > 0;
  addButton.disabled = !ready || cues.length >= 32;
  status.textContent = !visibleSlug ? 'Select a mix to save a cue point.'
    : cues.length >= 32 ? 'The cue list is full.'
      : !ready ? 'Start or load this mix to save a cue point.'
        : cues.length ? `${cues.length} saved in this browser.` : 'Save a moment to return to it later. Cues stay in this browser.';
  for (const cue of cues) {
    const slug = visibleSlug;
    const item = document.createElement('li');
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.className = 'cue-jump';
    jump.textContent = timeLabel(cue.time);
    jump.setAttribute('aria-label', `Go to ${timeLabel(cue.time)}${cue.label ? `, ${cue.label}` : ''}`);
    jump.disabled = !ready || cue.time > playback.duration;
    jump.addEventListener('click', () => {
      if (playback?.slug !== slug || !playback.isReady) return;
      window.parent.postMessage({ channel: 'lowkal.audio.v1', type: 'command', command: { action: 'seek', seconds: cue.time } }, window.location.origin);
    });
    const label = document.createElement('input');
    label.type = 'text';
    label.maxLength = 80;
    label.value = cue.label;
    label.placeholder = 'Name this moment';
    label.setAttribute('aria-label', `Name cue at ${timeLabel(cue.time)}`);
    label.addEventListener('change', () => { if (visibleSlug === slug) persist(renameCue(readCues(window.localStorage, slug), cue.id, label.value)); });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cue-remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove cue at ${timeLabel(cue.time)}`);
    remove.addEventListener('click', () => { if (visibleSlug === slug) persist(removeCue(readCues(window.localStorage, slug), cue.id)); });
    item.append(jump, label, remove);
    list.append(item);
  }
}

addButton.addEventListener('click', () => {
  if (!playback?.isReady || playback.slug !== visibleSlug || !Number.isFinite(playback.currentTime)) return;
  const cues = readCues(window.localStorage, visibleSlug);
  const next = addCue(cues, Math.min(playback.currentTime, playback.duration), crypto.randomUUID());
  if (next === cues) { status.textContent = 'A cue already exists at this time, or the list is full.'; return; }
  persist(next);
});

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.channel !== 'lowkal.audio.v1' || event.data.type !== 'state') return;
  const next = event.data.state;
  if (!next || typeof next.slug !== 'string') return;
  if (Number.isInteger(next.revision) && next.revision < lastRevision) return;
  if (Number.isInteger(next.revision)) lastRevision = next.revision;
  playback = next;
  if (visibleSlug !== next.slug) visibleSlug = next.slug;
  // Playback updates arrive often. Rebuild the list only when its controls change.
  const canAdd = next.isReady === true && Number.isFinite(next.duration) && next.duration > 0;
  if (list.dataset.slug !== visibleSlug || list.dataset.ready !== String(canAdd)) {
    list.dataset.slug = visibleSlug;
    list.dataset.ready = String(canAdd);
    render();
  }
});

window.parent.postMessage({ channel: 'lowkal.audio.v1', type: 'command', command: { action: 'request-state' } }, window.location.origin);
render();
