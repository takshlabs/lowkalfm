// This surface sends playback commands. The parent owns the audible player.
(() => {
  const get = (id) => document.getElementById(id);
  const modal = get('modal-settings');
  const opener = get('btn-settings-open');
  const closer = get('btn-settings-close');
  const audioChannel = 'lowkal.audio.v1';
  let returnFocus;
  let background = [];
  const clamp = (value, min, max, fallback = 0) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

  function send(channel, command) {
    if (window.parent === window) return;
    window.parent.postMessage({ channel, type: 'command', command }, window.location.origin);
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

  get('mixer-master').addEventListener('input', (event) => {
    const volume = clamp(Number(event.target.value), 0, 100, 60);
    renderVolume(volume);
    send(audioChannel, { action: 'volume', volume });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.type !== 'state' || !message.state || typeof message.state !== 'object') return;
    if (message.channel === audioChannel && Number.isFinite(message.state.volume)) {
      renderVolume(clamp(message.state.volume, 0, 100));
    }
  });

  renderVolume(60);
  send(audioChannel, { action: 'request-state' });
})();
