import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as playback from "../lib/audio-playback.ts";

// Exercise the real provider callbacks without a browser or network. React hooks
// retain state between explicit renders; media promises and events are controlled.
function harness() {
  const slots = []; let cursor = 0; let effects = []; let value; let tree;
  const records = [
    { slug: "one", title: "One", artist: "Test", artwork: "/one.png", series: "Test", duration: 100, startOffset: 10, playback: { provider: "cloudflare", url: "/one.mp3" } },
    { slug: "two", title: "Two", artist: "Test", artwork: "/two.png", series: "Test", duration: 120, startOffset: 0, playback: { provider: "cloudflare", url: "/two.mp3" } },
  ];
  const getRecord = slug => records.find(record => record.slug === slug);
  const hook = factory => { const index = cursor++; slots[index] ??= factory(); return slots[index]; };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial) { const slot = hook(() => ({ value: initial })); return [slot.value, next => { slot.value = typeof next === "function" ? next(slot.value) : next; }]; },
    useRef: initial => hook(() => ({ current: initial })),
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn, deps) { const slot = hook(() => ({})); if (!slot.deps || deps.some((item, i) => item !== slot.deps[i])) { effects.push(() => { slot.cleanup?.(); slot.cleanup = fn(); }); slot.deps = deps; } },
  };
  const requests = []; const messages = []; const listeners = {}; const timers = new Map(); let timerId = 0;
  const audio = { paused: true, ended: false, readyState: 0, duration: NaN, currentTime: 0, volume: .82,
    getAttribute: () => "/one.mp3", removeAttribute() {},
    play() { this.paused = false; return new Promise((resolve, reject) => requests.push({ resolve, reject })); },
    pause() { this.paused = true; }, load() { this.readyState = 0; },
  };
  const window = { location: { origin: "https://lowkalfm.in" }, localStorage: { getItem: () => null, setItem() {} }, screen: { width: 390, height: 844 }, matchMedia: () => ({ matches: true }), frames: [{ postMessage: message => messages.push(message) }],
    addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {}, setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id), setInterval: fn => { timers.set(++timerId, fn); return timerId; }, clearInterval: id => timers.delete(id) };
  const analysis = { setElement() {}, activate() {}, dispose() {}, read() {} };
  const compiled = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const jsx = (type, props) => { if (type === "provider") value = props.value; return { type, props }; };
  runInNewContext(code, { exports: compiled.exports, require(name) {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@/lib/audio-playback") return playback;
    if (name === "@/lib/audio-analysis") return { createAudioAnalysis: () => analysis, isAnalysisSource: () => false, startAnalysisBridge: () => () => {}, startMixerBridge: () => () => {} };
    if (name === "@/lib/site-path") return { sitePath: path => path };
    if (name === "./ListenContentProvider") return { useListenContent: () => ({ records, getRecord }) };
    throw new Error(name);
  }, window, navigator: { maxTouchPoints: 1 }, document: { addEventListener() {}, removeEventListener() {} }, queueMicrotask, console, setTimeout, clearTimeout });
  function render() { cursor = 0; effects = []; tree = compiled.exports.AudioProvider({ children: null }); const media = tree.props.children.find?.(child => child?.type === "audio"); media?.props.ref(audio); effects.forEach(fn => fn()); return value; }
  render(); render();
  return { render, audio, requests, messages, listeners, expire() { [...timers.values()].forEach(fn => fn()); timers.clear(); }, get value() { return value; }, event(name) { const media = tree.props.children.find(child => child?.type === "audio"); media.props[name]({ currentTarget: audio }); } };
}

test("toggle cancels loading intent before the playing event", () => {
  const h = harness();
  h.value.togglePlayback();
  h.value.togglePlayback();
  assert.equal(h.audio.paused, true);
  h.render();
  assert.equal(h.value.isLoading, false);
});

test("loading that never completes gives a retry instead of an endless spinner", () => {
  const h = harness();
  h.value.togglePlayback(); h.render(); h.expire(); h.render();
  assert.equal(h.value.isLoading, false);
  assert.equal(h.audio.paused, true);
  assert.equal(typeof h.value.error, "string");
});

test("playing an already running record does not leave it loading", () => {
  const h = harness();
  h.audio.readyState = 4; h.audio.paused = false;
  h.value.playRecord("one"); h.render();
  assert.equal(h.value.isLoading, false);
  assert.equal(h.value.isPlaying, true);
});

test("a queued zero seek overrides the record offset at metadata", () => {
  const h = harness();
  h.value.seek(0);
  h.audio.duration = 100; h.audio.readyState = 1;
  h.event("onLoadedMetadata");
  assert.equal(h.audio.currentTime, 0);
});

test("an old play rejection cannot cancel a newer play request", async () => {
  const h = harness();
  h.value.togglePlayback(); h.value.togglePlayback(); h.value.togglePlayback();
  h.requests[0].reject(new Error("old"));
  await Promise.resolve();
  h.render();
  assert.equal(h.value.isLoading, true);
  assert.equal(h.value.error, null);
});

test("ended playback advances to the next record when repeat is off", () => {
  const h = harness();
  h.audio.currentTime = 100; h.audio.duration = 100; h.audio.readyState = 1; h.audio.ended = true;
  h.event("onEnded"); h.render();
  assert.equal(h.value.activeRecord.slug, "two");
  assert.equal(h.value.repeatMode, "off");
});

test("media failure exposes retry and publishes the same error to the iframe", () => {
  const h = harness();
  h.event("onError"); h.render();
  assert.equal(typeof h.value.error, "string");
  assert.equal(h.value.isLoading, false);
  assert.equal(h.messages.at(-1).state.error, h.value.error);
  h.value.retryPlayback(); h.render();
  assert.equal(h.value.error, null);
  assert.equal(h.value.isLoading, true);
  assert.equal(h.messages.at(-1).state.isLoading, true);
});

test("provider exposes authoritative queue navigation and playback modes", () => {
  const h = harness();
  assert.equal(h.value.repeatMode, "off");
  h.value.playNext(); h.render();
  assert.equal(h.value.activeRecord.slug, "two");
  h.value.playPrevious(); h.render();
  assert.equal(h.value.activeRecord.slug, "one");
  h.value.toggleShuffle(); h.value.cycleRepeatMode(); h.render();
  assert.equal(h.value.isShuffled, true);
  assert.equal(h.value.repeatMode, "all");
});

test("mute is authoritative and preserves the selected volume", () => {
  const h = harness();
  assert.equal(h.value.isMuted, false);
  h.value.toggleMuted(); h.render();
  assert.equal(h.value.isMuted, true);
  assert.equal(h.audio.muted, true);
  assert.equal(h.value.volume, 82);
  h.value.toggleMuted(); h.render();
  assert.equal(h.audio.muted, false);
  assert.equal(h.value.volume, 82);
});

test("sleep timer expiry pauses without selecting another record", () => {
  const h = harness();
  h.value.setSleepTimer(15); h.render();
  assert.equal(h.value.sleepTimerMinutes, 15);
  h.expire(); h.render();
  assert.equal(h.audio.paused, true);
  assert.equal(h.value.activeRecord.slug, "one");
  assert.equal(h.value.sleepTimerMinutes, null);
});

test("provider restores saved playback state only once", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /const didRestoreRef = useRef\(false\)/);
  assert.match(source, /if \(didRestoreRef\.current\) return/);
  assert.match(source, /didRestoreRef\.current = true/);
});

test("all delayed playback starts claim cross-tab ownership", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  const playerStart = source.indexOf("new YT.Player");
  const onReady = source.slice(source.indexOf("onReady:", playerStart), source.indexOf("onStateChange:", playerStart));
  assert.match(onReady, /playMedia\(\)/);
  assert.doesNotMatch(onReady, /target\.playVideo\(\)/);
  assert.match(source, /comparePlaybackClaims/);
  assert.match(source, /PLAYBACK_CLAIM_STORAGE_KEY/);
});

test("Cloudflare errors do not switch playback providers", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  const start = source.lastIndexOf("onError={() =>");
  const onError = source.slice(start, source.indexOf("<track kind=", start));
  assert.doesNotMatch(onError, /youtube|setFailedAudioUrl|resumeAtRef/);
});

test("an idle YouTube pre-cue failure does not present playback failure before a play request", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  const start = source.indexOf("onError: () =>", source.indexOf("new YT.Player"));
  const onError = source.slice(start, source.indexOf("}\n        }\n      });", start));
  assert.match(source, /const youtubeFailureRef = useRef<string \| null>\(null\)/);
  assert.match(onError, /youtubeFailureRef\.current = "This video could not play\. Try again\."/);
  assert.match(onError, /if \(autoplayRef\.current\) setError\(youtubeFailureRef\.current\)/);
  assert.doesNotMatch(onError, /setError\("This video could not play\. Try again\."\)/);
});
