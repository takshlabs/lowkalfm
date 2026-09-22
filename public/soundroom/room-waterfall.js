import { readWaterfallBins } from './waterfall-state.js';

const modal = document.getElementById('modal-settings');
const canvas = document.getElementById('waterfall-canvas');
const status = document.getElementById('waterfall-status');
const context = canvas.getContext('2d', { alpha: false });
let playing = false;
let provider = '';
let sourceKey = '';
let hasSamples = false;
let lastSampleAt = 0;
let staleTimer;

function clear() {
  hasSamples = false;
  clearTimeout(staleTimer);
  if (!context) return;
  context.fillStyle = '#101510';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function resize() {
  if (!context || modal.hidden) return;
  const width = Math.max(1, Math.min(720, Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2))));
  const height = Math.max(1, Math.min(240, Math.round(canvas.clientHeight * Math.min(devicePixelRatio || 1, 2))));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  clear();
}

function updateStatus() {
  status.textContent = provider === 'youtube' ? 'YouTube does not share its audio spectrum.'
    : !playing ? hasSamples ? 'Paused. The last measured spectrum is shown.' : 'Play direct audio to see its spectrum.'
      : hasSamples && performance.now() - lastSampleAt < 1500 ? 'Live spectrum from this mix.'
        : 'No measured spectrum is available for this source or device.';
}

function draw(bins) {
  if (!context || modal.hidden) return;
  resize();
  const width = canvas.width;
  const height = canvas.height;
  context.drawImage(canvas, -2, 0);
  for (let index = 0; index < bins.length; index += 1) {
    const level = bins[index];
    const hue = 110 - Math.round(level * 95);
    const light = 7 + Math.round(level * 62);
    context.fillStyle = `hsl(${hue} 85% ${light}%)`;
    const top = Math.floor(height * (1 - (index + 1) / bins.length));
    const bottom = Math.ceil(height * (1 - index / bins.length));
    context.fillRect(width - 2, top, 2, bottom - top);
  }
  hasSamples = true;
  lastSampleAt = performance.now();
  clearTimeout(staleTimer);
  staleTimer = setTimeout(updateStatus, 1700);
  updateStatus();
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  const message = event.data;
  if (message?.channel === 'lowkal.audio.v1' && message.type === 'state') {
    const state = message.state;
    if (!state) return;
    if (sourceKey !== state.sourceKey) {
      sourceKey = state.sourceKey;
      clear();
    }
    playing = state.isPlaying === true;
    provider = state.provider;
    updateStatus();
  }
  if (message?.channel === 'lowkal.analysis.v1' && message.type === 'spectrum') {
    const bins = readWaterfallBins(message.data);
    if (playing && bins) draw(bins);
    else if (playing && !bins) updateStatus();
  }
});

new MutationObserver(() => { if (!modal.hidden) resize(); }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('resize', resize, { passive: true });
window.parent.postMessage({ channel: 'lowkal.audio.v1', type: 'command', command: { action: 'request-state' } }, window.location.origin);
updateStatus();
