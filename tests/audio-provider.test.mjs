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
  const requests = []; const messages = []; const listeners = {}; const documentListeners = {}; const timers = new Map(); const storage = new Map(); let timerId = 0;
  class MediaElement {
    constructor() { this.paused = false; this.listeners = {}; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    removeEventListener(name) { delete this.listeners[name]; }
    pause() { this.paused = true; this.listeners.pause?.(); }
  }
  const audio = { paused: true, ended: false, readyState: 0, duration: NaN, currentTime: 0, volume: .82,
    getAttribute: () => "/one.mp3", removeAttribute() {},
    play() { this.paused = false; return new Promise((resolve, reject) => requests.push({ resolve, reject })); },
    pause() { this.paused = true; }, load() { this.readyState = 0; },
  };
  const window = { location: { origin: "https://lowkalfm.in" }, localStorage: { getItem: key => storage.get(key) ?? null, setItem(key, value) { storage.set(key, value); } }, screen: { width: 390, height: 844 }, matchMedia: () => ({ matches: true }), frames: [{ postMessage: message => messages.push(message) }],
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
  }, window, navigator: { maxTouchPoints: 1 }, document: { addEventListener: (name, fn) => { (documentListeners[name] ??= []).push(fn); }, removeEventListener() {} }, HTMLMediaElement: MediaElement, queueMicrotask, console, setTimeout, clearTimeout });
  function render() { cursor = 0; effects = []; tree = compiled.exports.AudioProvider({ children: null }); const media = tree.props.children.find?.(child => child?.type === "audio"); media?.props.ref(audio); effects.forEach(fn => fn()); return value; }
  render(); render();
  const mediaProps = () => tree.props.children.find(child => child?.type === "audio")?.props;
  return { render, audio, requests, messages, storage, listeners, documentListeners, MediaElement, expire() { [...timers.values()].forEach(fn => fn()); timers.clear(); }, get value() { return value; }, mediaProps, event(name, target = audio) { mediaProps()?.[name]?.({ currentTarget: target }); } };
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

test("a committed seek stays authoritative until the media reports the new position", () => {
  const h = harness();
  h.value.seek(75); h.render();
  h.audio.currentTime = 30;
  h.event("onTimeUpdate"); h.render();
  assert.equal(h.value.currentTime, 75);

  h.audio.currentTime = 75.6;
  h.event("onTimeUpdate"); h.render();
  assert.equal(h.value.currentTime, 75.6);
});

test("a replacement source resumes from the last observed timeline position", () => {
  const h = harness();
  h.audio.duration = 100;
  h.audio.currentTime = 55;
  h.event("onTimeUpdate"); h.render();
  h.event("onLoadedMetadata");
  assert.equal(h.audio.currentTime, 55);
});

test("retry waits for metadata so playback cannot begin at a stale source position", () => {
  const h = harness();
  h.audio.readyState = 1;
  h.audio.currentTime = 55;
  h.value.retryPlayback();
  assert.equal(h.requests.length, 0);
});

test("a late event from a replaced native element cannot change the active session", () => {
  const h = harness();
  const oldProps = h.mediaProps();
  h.value.playRecord("two"); h.render();
  oldProps.onError({ currentTarget: { paused: true, currentTime: 0 } });
  h.render();
  assert.equal(h.value.activeRecord.slug, "two");
  assert.equal(h.value.error, null);
  assert.equal(h.value.isLoading, true);
});

test("an unexpected current-element pause makes the next transport action resume", () => {
  const h = harness();
  h.value.togglePlayback();
  h.audio.paused = true;
  h.event("onPause"); h.render();
  h.value.togglePlayback();
  assert.equal(h.requests.length, 2);
});

test("a reader audio element takes over from the Lowkal player", () => {
  const h = harness();
  h.value.togglePlayback();
  const readerAudio = new h.MediaElement();
  h.documentListeners.play.at(-1)({ target: readerAudio });
  h.render();
  assert.equal(h.audio.paused, true);
  assert.equal(h.value.isExternalMediaPlaying, true);
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

test("volume changes persist immediately while paused", () => {
  const h = harness();
  h.value.setVolume(43);
  const saved = JSON.parse(h.storage.get("lowkal.player.v1"));
  assert.equal(saved.volume, 43);
});

test("mute changes persist immediately while paused", () => {
  const h = harness();
  h.value.toggleMuted();
  const saved = JSON.parse(h.storage.get("lowkal.player.v1"));
  assert.equal(saved.muted, true);
  assert.equal(saved.volume, 82);
});

test("queue mode changes persist immediately while paused", () => {
  const h = harness();
  h.value.toggleShuffle();
  let saved = JSON.parse(h.storage.get("lowkal.player.v1"));
  assert.equal(saved.shuffled, true);
  h.render();
  h.value.cycleRepeatMode();
  saved = JSON.parse(h.storage.get("lowkal.player.v1"));
  assert.equal(saved.repeatMode, "all");
});

test("sleep deadline persists immediately so mobile suspension cannot erase it", () => {
  const h = harness();
  h.value.setSleepTimer(15);
  const saved = JSON.parse(h.storage.get("lowkal.player.v1"));
  assert.equal(saved.sleepTimer, 15);
  assert.ok(saved.sleepDeadline > Date.now());
});

test("returning from mobile background enforces an overdue sleep deadline", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!document\.hidden && typeof sleepTimer === "number" && sleepDeadlineRef\.current !== null && Date\.now\(\) >= sleepDeadlineRef\.current\)/);
  assert.match(source, /persist\(currentTimeRef\.current, \{ sleepTimer: null, sleepDeadline: null \}\)/);
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

test("provider retries a saved restore after the catalog hydrates", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /const didRestoreRef = useRef\(false\)/);
  assert.match(source, /if \(didRestoreRef\.current\) return/);
  assert.match(source, /if \(!saved\) \{ didRestoreRef\.current = true; return; \}/);
  assert.match(source, /if \(!getRecord\(saved\.slug\)\) return;/);
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

test("Soundroom commands must originate from the mounted Soundroom iframe", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /function isSoundroomFrameSource/);
  assert.match(source, /if \(!isSoundroomFrameSource\(event\.source\)\) return;/);
});

test("stale YouTube callbacks cannot mutate a replacement source", () => {
  const source = readFileSync(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  const youtubeEvents = source.slice(source.indexOf("events: {", source.indexOf("new YT.Player")), source.indexOf("}\n      });", source.indexOf("new YT.Player")));
  assert.match(source, /const ownsCurrentSession = \(\) => active && youtubeSessionRef\.current === session && sourceKeyRef\.current === activeSourceKey/);
  assert.match(youtubeEvents, /if \(!ownsCurrentSession\(\)\) return;/);
  assert.match(source, /if \(sourceKeyRef\.current !== sourceKey\) return null;/);
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
