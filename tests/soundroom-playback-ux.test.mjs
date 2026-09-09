import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const html = await readFile(new URL('../public/soundroom/index.html', import.meta.url), 'utf8');
function harness() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', attrs: {}, style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute(key, value) { this.attrs[key] = String(value); },
    });
    return elements.get(id);
  };
  const messages = [];
  const mix = { id: 'test-mix', title: 'Test mix', audioUrl: '/mix.mp3', duration: 3600 };
  const context = {
    MIXES: [mix], IS_EMBEDDED: true, AUDIO_SYNC_CHANNEL: 'lowkal.audio.v1',
    document: { body: { dataset: {} }, getElementById: get },
    window: { parent: { postMessage(message) { messages.push(JSON.parse(JSON.stringify(message))); } }, location: { origin: 'https://lowkalfm.in' } },
    HtmlAudioPlayerEngine: class { pause() {} getDuration() { return 0; } },
  };
  const format = html.slice(html.indexOf('    function formatTime('), html.indexOf('    function formatTime(') + html.slice(html.indexOf('    function formatTime(')).indexOf('\n    }') + 6);
  const appSource = html.slice(html.indexOf('    class LowkalApp {'), html.indexOf('    // Register bridges synchronously'));
  runInNewContext(`${format}\n${appSource}\nglobalThis.app = new LowkalApp();`, context);
  const app = context.app;
  app.updateVolumeUI = () => {};
  app.renderPlaybackModes = () => {};
  app.syncMixDetails = () => {};
  const state = overrides => app.applyExternalAudioState({ slug: mix.id, currentTime: 65, duration: 3600, isPlaying: false, isReady: true, ...overrides });
  return { app, get, messages, state };
}

test('external loading is truthful and can be cancelled without starting local audio', () => {
  const { app, get, messages, state } = harness();
  state({ isLoading: true, isReady: false });
  assert.equal(get('main-status-text').textContent, 'Loading');
  for (const id of ['btn-main-play', 'btn-mini-play']) {
    assert.equal(get(id).disabled, false);
    assert.equal(get(id).attrs['aria-label'], 'Cancel loading');
  }
  app.togglePlayback();
  assert.equal(messages.at(-1).command.action, 'pause');
});

test('seeking requires metadata and hidden mini-player is not focusable', () => {
  const { app, get, state } = harness();
  state({ isReady: false });
  assert.equal(get('main-scrubber').disabled, true);
  assert.equal(get('archive-mini-player').inert, true);
  app.currentScreen = 'archive';
  state({ isReady: true });
  assert.equal(get('main-scrubber').disabled, false);
  assert.equal(get('archive-mini-player').inert, false);
  assert.equal(get('main-scrubber').attrs['aria-valuetext'], '01:05 of 60:00');
});

test('errors expose retry on both surfaces and clear on older state messages', () => {
  const { app, get, messages, state } = harness();
  app.currentScreen = 'archive';
  state({ error: 'Audio could not load.', isReady: false });
  assert.equal(get('main-status-text').textContent, 'Playback failed');
  assert.equal(get('main-status-text').attrs['aria-label'], 'Audio could not load.');
  assert.match(get('mini-subtext').textContent, /Playback failed/);
  assert.equal(get('icon-mini-play').textContent, 'refresh');
  assert.equal(get('btn-main-play').attrs['aria-label'], 'Retry playback');
  assert.equal(get('btn-mini-play').attrs['aria-label'], 'Retry playback');
  app.togglePlayback();
  assert.equal(messages.at(-1).command.action, 'retry');
  state({ isReady: undefined });
  assert.equal(app.error, null);
  assert.equal(app.isLoading, false);
  assert.equal(get('main-status-text').textContent, 'Not ready');
});
