import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const moduleUrl = new URL('../public/soundroom/visual-state.js', import.meta.url);

test('visual state accepts only finite, bounded real audio bands', async () => {
  const { readSpectrum } = await import(moduleUrl);
  assert.deepEqual(readSpectrum({ available: true, bass: 2, mid: -1, treble: 0.5, level: 0.4 }), { available: true, bass: 1, mid: 0, treble: 0.5, level: 0.4 });
  for (const value of [null, {}, { available: true, bass: NaN }, { available: false, bass: 1 }]) {
    assert.deepEqual(readSpectrum(value), { available: false, bass: 0, mid: 0, treble: 0, level: 0 });
  }
});

test('stale, paused and reduced-motion frames never simulate an audio signal', async () => {
  const { visualFrame } = await import(moduleUrl);
  const signal = { available: true, bass: 0.8, mid: 0.4, treble: 0.2, level: 0.5 };
  assert.equal(visualFrame(signal, { playing: true, age: 100 }).mode, 'reactive');
  for (const options of [{ playing: false, age: 0 }, { playing: true, age: 2000 }]) {
    const frame = visualFrame(signal, options);
    assert.equal(frame.bass, 0);
    assert.equal(frame.mode, 'ambient');
  }
  assert.equal(visualFrame(signal, { playing: true, age: 0, still: true }).mode, 'still');
});

test('the room keeps a split player with accessible scene and motion controls', async () => {
  const html = await readFile(new URL('../public/soundroom/index.html', import.meta.url), 'utf8');
  for (const id of ['artwork-stage', 'player-panel', 'visual-scene', 'visual-motion', 'visual-intensity', 'visual-focus', 'signal-bass', 'signal-mid', 'signal-treble']) {
    assert.ok(html.includes(`id="${id}"`), `Missing ${id}`);
  }
  assert.match(html, /aria-label="Playback position"/);
  assert.match(html, /aria-label="Volume"/);
  assert.match(html, /room-visuals\.js/);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com|three\.min\.js|class LowkalVisualizer|DJ Void/);
});
