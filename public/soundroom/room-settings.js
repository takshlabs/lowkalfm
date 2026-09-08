// This surface sends commands only. Audio and visual rendering have separate owners.
(() => {
  const get = (id) => document.getElementById(id);
  const modal = get('modal-settings');
  const opener = get('btn-settings-open');
  const closer = get('btn-settings-close');
  const bands = ['bass', 'mid', 'treble'];
  const mixerChannel = 'lowkal.mixer.v1';
  const audioChannel = 'lowkal.audio.v1';
  let state = { bass: 0, mid: 0, treble: 0, enabled: true, available: false };
  let returnFocus;
  let background = [];
  const clamp = (value, min, max, fallback = 0) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

  function send(channel, command) {
    if (window.parent === window) return;
    window.parent.postMessage({ channel, type: 'command', command }, window.location.origin);
  }

  function renderMixer() {
    bands.forEach((band) => {
      get(`mixer-${band}`).value = String(state[band]);
      get(`mixer-${band}`).disabled = !state.available;
      get(`mixer-${band}-value`).textContent = `${state[band] > 0 ? '+' : ''}${state[band]} dB`;
      get(`mixer-${band}`).setAttribute('aria-valuetext', `${state[band]} decibels`);
    });
    get('mixer-bypass').disabled = !state.available;
    get('mixer-reset').disabled = !state.available;
    get('mixer-bypass').setAttribute('aria-pressed', String(!state.enabled));
    get('mixer-status').textContent = !state.available
      ? 'EQ unavailable for this source. Master volume is available.'
      : state.enabled ? 'EQ active. Meters show the real audio signal.' : 'EQ bypassed. Master volume is available.';
  }

  function setMixer(settings) {
    if (!state.available) return;
    state = { ...state, ...settings };
    const { bass, mid, treble, enabled } = state;
    send(mixerChannel, { action: 'set', settings: { bass, mid, treble, enabled } });
    renderMixer();
  }

  function renderVolume(volume) {
    get('mixer-master').value = String(volume);
    get('mixer-master-value').textContent = `${volume}%`;
    get('mixer-master').setAttribute('aria-valuetext', `${volume} percent`);
  }

  function showSettings(show) {
    if (show === !modal.hidden) return;
    if (show) {
      returnFocus = document.activeElement;
      background = [...document.querySelectorAll('body > header, #screen-home, #screen-archive')]
        .map((element) => ({ element, inert: element.inert }));
      modal.hidden = false;
      modal.inert = false;
      background.forEach(({ element }) => { element.inert = true; });
      closer.focus();
      send(mixerChannel, { action: 'request-state' });
      send(audioChannel, { action: 'request-state' });
    } else {
      modal.hidden = true;
      modal.inert = true;
      background.forEach(({ element, inert }) => { element.inert = inert; });
      (returnFocus?.isConnected ? returnFocus : opener).focus();
    }
    opener.setAttribute('aria-expanded', String(show));
  }

  opener.addEventListener('click', () => showSettings(true));
  closer.addEventListener('click', () => showSettings(false));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) showSettings(false);
  });
  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      showSettings(false);
    } else if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]')]
        .filter((element) => !element.hidden && element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  bands.forEach((band) => get(`mixer-${band}`).addEventListener('input', (event) => {
    setMixer({ [band]: clamp(Number(event.target.value), -12, 6) });
  }));
  get('mixer-bypass').addEventListener('click', () => setMixer({ enabled: !state.enabled }));
  get('mixer-reset').addEventListener('click', () => setMixer({ bass: 0, mid: 0, treble: 0, enabled: true }));
  get('mixer-master').addEventListener('input', (event) => {
    const volume = clamp(Number(event.target.value), 0, 100, 60);
    renderVolume(volume);
    send(audioChannel, { action: 'volume', volume });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.type !== 'state' || !message.state || typeof message.state !== 'object') return;
    if (message.channel === mixerChannel) {
      const incoming = message.state;
      state = {
        bass: clamp(incoming.bass, -12, 6), mid: clamp(incoming.mid, -12, 6), treble: clamp(incoming.treble, -12, 6),
        enabled: incoming.enabled === true, available: incoming.available === true,
      };
      renderMixer();
    } else if (message.channel === audioChannel && Number.isFinite(message.state.volume)) {
      renderVolume(clamp(message.state.volume, 0, 100));
    }
  });

  renderMixer();
  renderVolume(60);
  send(mixerChannel, { action: 'request-state' });
  send(audioChannel, { action: 'request-state' });
})();
