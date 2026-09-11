import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

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

test('room assets resolve after clean-URL redirects and under a site prefix', async () => {
  const html = await readFile(new URL('../public/soundroom/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script id="soundroom-base">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'Missing clean-URL base resolution');
  for (const pathname of ['/soundroom', '/soundroom/', '/soundroom/index.html', '/lowkalfm/soundroom/index.html']) {
    let base;
    runInNewContext(script, { window: { location: { origin: 'https://example.com', pathname } }, document: { createElement: () => ({}), head: { append: (element) => { base = element.href; } } } });
    assert.equal(new URL('room.css', base).pathname, pathname.startsWith('/lowkalfm/') ? '/lowkalfm/soundroom/room.css' : '/soundroom/room.css');
  }
});

test('the room restores the original split player and moves controls into settings', async () => {
  const html = await readFile(new URL('../public/soundroom/index.html', import.meta.url), 'utf8');
  assert.match(html, /max-w-5xl mx-auto flex flex-col md:flex-row/);
  assert.match(html, /md:w-\[380px\] md:h-\[380px\] rounded-2xl/);
  assert.match(html, /md:w-\[460px\] h-\[55vh\] md:h-\[72vh\] glass-panel/);
  assert.equal((html.match(/<canvas\b/g) || []).length, 1);
  assert.doesNotMatch(html, /visual-dock|visual-scene|visual-focus|Soundroom\.<\/h1>|room-layout/);
  for (const id of ['btn-settings-open', 'modal-settings', 'visual-motion', 'visual-intensity', 'signal-bass', 'signal-mid', 'signal-treble']) {
    assert.ok(html.includes(`id="${id}"`), `Missing ${id}`);
  }
  assert.match(html, /aria-label="Playback position"/);
  assert.match(html, /aria-label="Volume"/);
  assert.match(html, /room-visuals\.js/);
  assert.match(html, /href="\.\/tailwind\.css"/);
  assert.match(html, /href="\.\/material-symbols\.css"/);
  assert.doesNotMatch(html, /three\.min\.js|class LowkalVisualizer|DJ Void|createOscillator/);
});
