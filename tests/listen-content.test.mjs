import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as order from '../lib/listen-order.ts';
import * as source from '../lib/audio-source.ts';

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness() {
  const slots = []; let cursor = 0; let effects = []; let value;
  const requests = [];
  const counter = deferred();
  const hook = (factory) => { const i = cursor++; slots[i] ??= factory(); return slots[i]; };
  const memo = (fn, deps) => { const slot = hook(() => ({})); if (!slot.deps || deps.some((item, i) => item !== slot.deps[i])) { slot.value = fn(); slot.deps = deps; } return slot.value; };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState(initial) { const slot = hook(() => ({ value: typeof initial === 'function' ? initial() : initial })); return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useRef: (initial) => hook(() => ({ current: initial })),
    useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) { const slot = hook(() => ({})); if (!slot.deps || deps.some((item, i) => item !== slot.deps[i])) { effects.push(() => { slot.cleanup?.(); slot.cleanup = fn(); }); slot.deps = deps; } }
  };
  const compiled = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../components/ListenContentProvider.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, { exports: compiled.exports, require(id) {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx: (_, props) => { value = props.value; return null; } };
    if (id === '@vercel/analytics') return { track() {} };
    if (id === '@/lib/audio-source') return source;
    if (id === '@/lib/listen-order') return order;
    if (id === '@/lib/content') return { soundRecords: [{ slug: 'old-unlisted' }], artistProfiles: [{ slug: 'old-artist' }], livePrograms: [{ slug: 'old-programme' }] };
    if (id === '@/lib/sanity') return { isSanityConfigured: true, listenContentQuery: 'query', sanityImageUrl: (value) => value, sanityFetch: () => { const request = deferred(); requests.push(request); return request.promise; } };
    throw new Error(id);
  }, process: { env: { NODE_ENV: 'production' } }, window: { sessionStorage: { removeItem() {}, getItem: () => JSON.stringify({ savedAt: Date.now(), content: { mixes: [{ slug: 'cached-unlisted' }] } }) }, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {} }, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, AbortController, fetch: () => counter.promise });
  const render = () => { cursor = 0; effects = []; compiled.exports.ListenContentProvider({ children: null }); effects.forEach((fn) => fn()); return value; };
  render();
  return { render, requests, counter, get value() { return value; } };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const mix = { slug: 'published', artwork: '/art.jpg', title: 'Published', series: 'Volume', releaseDate: '2026-09-01', format: 'volume', audioDeliveryUrl: 'https://audio.example/mix.mp3', showOnHome: false };

test('no local or saved mix can appear while the CMS loads, or after an empty result', async () => {
  const h = harness();
  assert.equal(h.value.records.length, 0);
  assert.equal(h.value.isLoading, true);
  h.requests[0].resolve({ mixes: [], artists: [], programmes: [] }); await flush(); h.render();
  assert.equal(h.value.records.length, 0);
  assert.equal(h.value.artists.length, 0);
  assert.equal(h.value.programmes.length, 0);
  assert.equal(h.value.isLoading, false);
});

test('CMS failures do not restore old content and a retry can recover', async () => {
  const h = harness(); h.requests[0].reject(new Error('offline')); await flush(); h.render();
  assert.equal(h.value.records.length, 0);
  assert.match(h.value.error, /Try again/);
  h.value.refresh(); h.render();
  h.requests[1].resolve({ mixes: [mix] }); await flush(); h.render();
  assert.equal(h.value.error, null);
  assert.equal(h.value.records[0].slug, 'published');
});

test('count updates keep catalogue references stable and optional field-note tags are safe', async () => {
  const h = harness(); h.requests[0].resolve({ mixes: [mix], artists: [{ slug: 'artist', fieldNotes: [{ placeName: 'Place', tags: null }] }] }); await flush(); h.render();
  const records = h.value.records; const getRecord = h.value.getRecord; const artists = h.value.artists;
  assert.equal(records[0].showOnHome, false);
  assert.equal(artists[0].fieldNotes[0].tags.length, 0);
  h.counter.resolve({ ok: true, json: async () => ({ total: 123 }) }); await flush(); h.render();
  assert.equal(h.value.listenCounts.published, 123);
  assert.equal(h.value.records, records);
  assert.equal(h.value.records[0], records[0]);
  assert.equal(h.value.getRecord, getRecord);
  assert.equal(h.value.artists, artists);
});
