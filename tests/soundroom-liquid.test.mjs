import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { visualFrame } from '../public/soundroom/visual-state.js';
import { readSpectrum } from '../public/soundroom/visual-state.js';
import { runInNewContext } from 'node:vm';

const measured = { available: true, bass: 0.7, mid: 0.3, treble: 0.2, level: 0.4 };

test('mixer meters receive real levels even when graphics are unavailable or paused', async () => {
  const source = await readFile(new URL('../public/soundroom/room-visuals.js', import.meta.url), 'utf8');
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { style: {}, dataset: {}, value: '65', getContext: () => null, addEventListener() {}, setAttribute() {} });
    return elements.get(id);
  };
  const listeners = {};
  const window = { location: { origin: 'https://example.com' }, parent: {}, matchMedia: () => ({ matches: true, addEventListener() {} }), addEventListener: (type, fn) => { listeners[type] = fn; } };
  runInNewContext(source.replace(/^import .*;\n/, ''), { readSpectrum, visualFrame, window, document: { hidden: false, body: { dataset: {} }, documentElement: { style: { setProperty() {} } }, getElementById: element, addEventListener() {} }, performance: { now: () => 10 }, innerWidth: 900, innerHeight: 600, cancelAnimationFrame() {}, requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {}, console });
  listeners.message({ origin: window.location.origin, source: window.parent, data: { channel: 'lowkal.analysis.v1', type: 'spectrum', data: measured } });
  assert.equal(element('signal-bass').style.transform, 'scaleY(0.7)');
  listeners.message({ origin: window.location.origin, source: window.parent, data: { channel: 'lowkal.audio.v1', type: 'state', state: { isPlaying: false } } });
  assert.equal(element('signal-bass').style.transform, 'scaleY(0)');
});

test('measured audio takes exclusive control from the pointer', () => {
  assert.equal(visualFrame(measured, { playing: true, age: 0 }).pointerWeight, 0);
  assert.equal(visualFrame(measured, { playing: true, age: 2000 }).pointerWeight, 1);
  assert.equal(visualFrame(measured, { playing: false, age: 0 }).pointerWeight, 1);
  assert.equal(visualFrame(null, { playing: true, age: 0 }).pointerWeight, 1);
  assert.equal(visualFrame(measured, { playing: true, age: 0, still: true }).pointerWeight, 0);
});

test('the original simplex liquid shader is retained without replacement scenes', async () => {
  const source = await readFile(new URL('../public/soundroom/room-visuals.js', import.meta.url), 'utf8');
  assert.match(source, /float snoise\(vec2 v\)/);
  assert.match(source, /return 130\.0\*dot\(m,g\)/);
  assert.match(source, /body\*0\.72/);
  assert.match(source, /highlight\*0\.52/);
  assert.match(source, /u_pointerWeight/);
  assert.match(source, /frame\.pointerWeight/);
  assert.doesNotMatch(source, /u_scene|visual-scene|Orbital|Contour|Aurora/);
});
