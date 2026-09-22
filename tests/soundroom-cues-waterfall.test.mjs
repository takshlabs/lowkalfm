import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { addCue, readCues, removeCue, renameCue, writeCues } from '../public/soundroom/cue-store.js';
import { readWaterfallBins } from '../public/soundroom/waterfall-state.js';
import { waterfallFromBins } from '../lib/audio-analysis.ts';

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('cue points are stored per mix, sorted, bounded and can be renamed or removed', () => {
  const saved = storage();
  const first = addCue([], 67.24, 'a');
  assert.equal(addCue(first, 67.8, 'duplicate'), first);
  const cues = addCue(first, 12, 'b');
  assert.deepEqual(cues.map((cue) => cue.time), [12, 67.2]);
  assert.equal(writeCues(saved, 'mix-one', renameCue(cues, 'a', '  Great drop  ')), true);
  assert.equal(readCues(saved, 'mix-one')[1].label, 'Great drop');
  assert.deepEqual(readCues(saved, 'mix-two'), []);
  assert.deepEqual(removeCue(readCues(saved, 'mix-one'), 'b').map((cue) => cue.id), ['a']);
  assert.equal(addCue(cues, NaN, 'bad'), cues);
  assert.equal(addCue(cues, 90000, 'bad'), cues);
});

test('cue controls save the active playhead and seek through the parent', async () => {
  const source = await readFile(new URL('../public/soundroom/room-cues.js', import.meta.url), 'utf8');
  const values = storage();
  const nodes = new Map();
  function make(id = '') {
    return { id, children: [], dataset: {}, events: {}, disabled: false, textContent: '', value: '',
      addEventListener(type, fn) { this.events[type] = fn; },
      setAttribute() {}, append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; } };
  }
  const document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, make(id)); return nodes.get(id); }, createElement: () => make() };
  const listeners = {};
  const messages = [];
  const parent = { postMessage(message) { messages.push(message); } };
  const window = { parent, localStorage: values, location: { origin: 'https://lowkalfm.in' }, addEventListener(type, fn) { listeners[type] = fn; } };
  runInNewContext(source.replace(/^import .*;\n/, ''), { window, document, crypto: { randomUUID: () => 'cue-id' }, addCue, readCues, removeCue, renameCue, writeCues });
  const send = (state, origin = window.location.origin) => listeners.message({ source: parent, origin, data: { channel: 'lowkal.audio.v1', type: 'state', state } });
  send({ slug: 'mix-one', currentTime: 65, duration: 300, isReady: true }, 'https://evil.test');
  assert.equal(document.getElementById('cue-add').disabled, true);
  send({ slug: 'mix-one', currentTime: 65, duration: 300, isReady: true });
  document.getElementById('cue-add').events.click();
  assert.equal(readCues(values, 'mix-one')[0].time, 65);
  const item = document.getElementById('cue-list').children[0];
  item.children[0].events.click();
  assert.deepEqual(JSON.parse(JSON.stringify(messages.at(-1).command)), { action: 'seek', seconds: 65 });
  item.children[1].value = '  Break  ';
  item.children[1].events.change();
  assert.equal(readCues(values, 'mix-one')[0].label, 'Break');
  send({ slug: 'mix-two', currentTime: 4, duration: 300, isReady: true });
  assert.equal(document.getElementById('cue-list').children.length, 0);
  send({ slug: 'mix-one', currentTime: 20, duration: 300, isReady: true });
  assert.equal(document.getElementById('cue-list').children.length, 1);
  document.getElementById('cue-list').children[0].children[2].events.click();
  assert.deepEqual(readCues(values, 'mix-one'), []);
});

test('waterfall uses measured, logarithmic frequency bands and rejects absent data', () => {
  const signal = new Uint8Array(1024);
  signal.fill(255, 1, 20);
  const bins = waterfallFromBins(signal, 48000);
  assert.equal(bins.length, 48);
  assert.ok(bins[0] > bins[47]);
  assert.ok(bins.every((value) => value >= 0 && value <= 1));
  assert.equal(readWaterfallBins({ available: true, bins })?.length, 48);
  assert.equal(readWaterfallBins({ available: false, bins }), null);
  assert.equal(readWaterfallBins({ available: true, bins: [1, 2] }), null);
  assert.deepEqual(waterfallFromBins(signal, 0), []);
});
