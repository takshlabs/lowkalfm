import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const analysis = await import("../lib/audio-analysis.ts").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const origin = "https://lowkalfm.in";

test("analysis permits only same-origin and exact trusted HTTPS audio origins", () => {
  assert.equal(typeof analysis.isAnalysisSource, "function");
  for (const url of ["/audio/mix.wav", `${origin}/mix.mp3`, "https://cdn.sanity.io/files/project/mix.wav", "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev/audio/mix.wav"]) {
    assert.equal(analysis.isAnalysisSource(url, origin), true, url);
  }
  for (const url of [undefined, "", "https://external.example/mix.mp3", "https://cdn.sanity.io.evil.example/mix.wav", "https://cdn.sanity.io:444/mix.wav", "http://cdn.sanity.io/mix.wav", "https://user:pass@cdn.sanity.io/mix.wav", "data:audio/wav;base64,AAAA", "blob:https://lowkalfm.in/id", "https://[bad"]) {
    assert.equal(analysis.isAnalysisSource(url, origin), false, String(url));
  }
});

test("real FFT bands and waveform RMS produce bounded spectrum, including silence", () => {
  assert.equal(typeof analysis.spectrumFromBins, "function");
  // 10 Hz per bin; DC is excluded, bands are 20–250, 250–2000, 2000–16000 Hz.
  const bins = new Uint8Array(2400);
  bins.fill(255, 2, 25);
  bins.fill(128, 25, 200);
  bins.fill(64, 200, 1600);
  const signal = new Uint8Array([0, 128, 0, 128]);
  const value = analysis.spectrumFromBins(bins, signal, 48000);
  assert.equal(value.bass, 1);
  assert.equal(value.mid, 128 / 255);
  assert.equal(value.treble, 64 / 255);
  assert.equal(value.level, Math.sqrt(0.5));
  assert.equal(value.available, true);
  assert.deepEqual(analysis.spectrumFromBins(new Uint8Array(2400), new Uint8Array(4).fill(128), 48000), { bass: 0, mid: 0, treble: 0, level: 0, available: true });
  for (const rate of [0, NaN, 8000, 44100, 96000]) {
    const result = analysis.spectrumFromBins(new Uint8Array(4).fill(255), new Uint8Array(), rate);
    for (const name of ["bass", "mid", "treble", "level"]) assert.ok(Number.isFinite(result[name]) && result[name] >= 0 && result[name] <= 1);
  }
});

function audioHarness() {
  const nodes = [];
  const filters = [];
  const gains = [];
  const param = (value = 0) => ({ value, ramps: [], cancelAndHoldAtTime() {},
    linearRampToValueAtTime(value, time) { this.value = value; this.ramps.push({ value, time }); },
    exponentialRampToValueAtTime(value, time) { this.value = value; this.ramps.push({ value, time }); } });
  const node = () => ({ outputs: new Set(), connect(target) { this.outputs.add(target); }, disconnect() { this.outputs.clear(); } });
  const context = {
    state: "suspended", sampleRate: 48000, currentTime: 1, destination: {}, resumes: 0, closes: 0, reads: 0,
    createBiquadFilter() { const filter = { ...node(), gain: param(), frequency: param(), Q: param(1) }; filters.push(filter); return filter; },
    createGain() { const gain = { ...node(), gain: param(1) }; gains.push(gain); return gain; },
    resume() { this.resumes += 1; this.state = "running"; return Promise.resolve(); },
    close() { this.closes += 1; this.state = "closed"; return Promise.resolve(); },
    createMediaElementSource(element) { const source = { ...node(), element }; nodes.push(source); return source; },
    createAnalyser() {
      return { ...node(), fftSize: 2048, frequencyBinCount: 1024,
        getByteFrequencyData(array) { context.reads += 1; array.fill(255); },
        getByteTimeDomainData(array) { array.fill(0); },
      };
    },
  };
  const element = (src = `${origin}/audio/mix.wav`) => ({ src, currentSrc: src, crossOrigin: "anonymous", paused: false, ended: false });
  return { context, nodes, element, filters, gains };
}

function audiblePath(source, destination) {
  if (!source?.outputs) return 0;
  return [...source.outputs].reduce((count, output) => count + (output === destination ? 1 : audiblePath(output, destination)), 0);
}

test("activation resumes synchronously, reuses each element source and keeps one audible output", async () => {
  assert.equal(typeof analysis.createAudioAnalysis, "function");
  const { context, nodes, element } = audioHarness();
  const engine = analysis.createAudioAnalysis(() => context, origin);
  const first = element();
  engine.setElement(first);
  assert.equal(nodes.length, 0, "no Web Audio graph before playback activation");
  engine.activate();
  assert.equal(context.resumes, 1, "resume must run in the activation stack");
  await Promise.resolve();
  assert.equal(nodes.length, 1);
  assert.equal(audiblePath(nodes[0], context.destination), 1);
  assert.deepEqual(engine.read(), { bass: 1, mid: 1, treble: 1, level: 1, available: true });
  engine.activate();
  await Promise.resolve();
  assert.equal(nodes.length, 1);
  engine.setElement(null);
  assert.equal(nodes[0].outputs.size, 0, "removed elements must be disconnected");
  assert.equal(engine.read().available, false, "YouTube has no media element");
  engine.setElement(first);
  engine.activate();
  await Promise.resolve();
  assert.equal(nodes.length, 1, "React ref replay must not attach a second source");
  assert.equal(audiblePath(nodes[0], context.destination), 1);
  engine.setElement(element());
  engine.activate();
  await Promise.resolve();
  assert.equal(nodes.length, 2, "keyed element changes get their own source");
  assert.equal(nodes[0].outputs.size, 0);
  assert.equal(audiblePath(nodes[1], context.destination), 1);
  engine.dispose();
  assert.equal(nodes[1].outputs.size, 0);
  assert.equal(context.closes, 1);
});

test("mixer inserts three EQ bands and headroom in one path with FFT after EQ", async () => {
  const { context, nodes, filters, gains, element } = audioHarness();
  const engine = analysis.createAudioAnalysis(() => context, origin);
  assert.deepEqual(engine.getMixer(), { bass: 0, mid: 0, treble: 0, enabled: true, available: false });
  engine.setMixer({ bass: 6, mid: 3, treble: -4 });
  engine.setElement(element());
  engine.activate();
  await Promise.resolve();
  assert.deepEqual(filters.map((filter) => [filter.type, filter.frequency.value]), [["lowshelf", 250], ["peaking", 1000], ["highshelf", 4000]]);
  assert.equal(filters[1].Q.value, 1);
  assert.deepEqual(filters.map((filter) => filter.gain.value), [6, 3, -4]);
  assert.ok(Math.abs(gains[0].gain.value - 10 ** (-9 / 20)) < 1e-10);
  assert.deepEqual([...nodes[0].outputs], [gains[0]]);
  assert.deepEqual([...gains[0].outputs], [filters[0]]);
  assert.deepEqual([...filters[0].outputs], [filters[1]]);
  assert.deepEqual([...filters[1].outputs], [filters[2]]);
  assert.equal(filters[2].outputs.size, 2, "only the post-EQ output feeds destination and FFT");
  assert.equal(audiblePath(nodes[0], context.destination), 1);
  assert.equal(engine.getMixer().available, true);
  engine.setMixer({ bass: -6 });
  assert.ok(filters[0].gain.ramps.at(-1).time > context.currentTime, "live changes are smoothed");
});

test("mixer clamps finite numbers, ignores invalid fields, bypasses and resets without rewiring", async () => {
  const { context, nodes, filters, gains, element } = audioHarness();
  const engine = analysis.createAudioAnalysis(() => context, origin);
  engine.setElement(element()); engine.activate(); await Promise.resolve();
  engine.setMixer({ bass: 100, mid: -100, treble: 2, enabled: false });
  assert.deepEqual(engine.getMixer(), { bass: 6, mid: -12, treble: 2, enabled: false, available: true });
  assert.deepEqual(filters.map((filter) => filter.gain.value), [0, 0, 0]);
  assert.equal(gains[0].gain.value, 1);
  engine.setMixer({ bass: NaN, mid: Infinity, treble: "6", enabled: "true", volume: 0 });
  assert.deepEqual(engine.getMixer(), { bass: 6, mid: -12, treble: 2, enabled: false, available: true });
  for (const settings of [null, [], "bad", undefined]) assert.doesNotThrow(() => engine.setMixer(settings));
  engine.setMixer({ enabled: true });
  assert.deepEqual(filters.map((filter) => filter.gain.value), [6, -12, 2]);
  engine.resetMixer();
  assert.deepEqual(engine.getMixer(), { bass: 0, mid: 0, treble: 0, enabled: true, available: true });
  assert.equal(audiblePath(nodes[0], context.destination), 1);
  engine.setElement(null);
  assert.equal(engine.getMixer().available, false);
  engine.setElement(element("https://external.example/a.mp3")); engine.activate(); await Promise.resolve();
  assert.equal(engine.getMixer().available, false);
});

test("unsafe and non-CORS media never enter Web Audio or change their playback attributes", async () => {
  const { context, nodes, element } = audioHarness();
  let creations = 0;
  const engine = analysis.createAudioAnalysis(() => { creations += 1; return context; }, origin);
  for (const media of [element("https://external.example/mix.mp3"), { ...element(), crossOrigin: null }]) {
    const before = { ...media };
    engine.setElement(media);
    engine.activate();
    await Promise.resolve();
    assert.equal(creations, 0);
    assert.equal(nodes.length, 0);
    assert.equal(engine.read().available, false);
    assert.deepEqual(media, before);
  }
});

test("Web Audio failures do not throw into playback or capture a suspended context", async () => {
  for (const failure of ["constructor", "resume", "suspended", "analyser", "source", "read", "close"]) {
    const { context, nodes, element } = audioHarness();
    const fail = () => { throw new Error(failure); };
    if (failure === "resume") context.resume = () => Promise.reject(new Error(failure));
    if (failure === "suspended") context.resume = () => Promise.resolve();
    if (failure === "analyser") context.createAnalyser = fail;
    if (failure === "source") context.createMediaElementSource = fail;
    if (failure === "read") context.createAnalyser = () => ({ fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData: fail, disconnect() {} });
    if (failure === "close") context.close = () => Promise.reject(new Error(failure));
    const engine = analysis.createAudioAnalysis(failure === "constructor" ? fail : () => context, origin);
    engine.setElement(element());
    assert.doesNotThrow(() => engine.activate(), failure);
    await new Promise(setImmediate);
    if (failure !== "close") assert.equal(engine.read().available, false, failure);
    if (["constructor", "resume", "suspended", "analyser", "source"].includes(failure)) assert.equal(nodes.length, 0, failure);
    if (failure === "read") assert.equal(audiblePath(nodes[0], context.destination), 1, "sampling failure must keep the audible output");
    assert.doesNotThrow(() => engine.dispose());
    await new Promise(setImmediate);
  }
});

test("pending activation rechecks source safety and live availability rejects failed media", async () => {
  const { context, nodes, element } = audioHarness();
  let resume;
  context.resume = () => new Promise((resolve) => { resume = () => { context.state = "running"; resolve(); }; });
  const engine = analysis.createAudioAnalysis(() => context, origin);
  const media = element();
  engine.setElement(media); engine.activate();
  media.currentSrc = media.src = "https://external.example/mix.mp3";
  resume(); await Promise.resolve();
  assert.equal(nodes.length, 0, "a changed source cannot enter a pending graph");
  media.currentSrc = media.src = `${origin}/audio/mix.wav`;
  engine.activate(); resume(); await Promise.resolve();
  assert.equal(engine.getMixer().available, true);
  media.error = { code: 4 };
  assert.equal(engine.getMixer().available, false);
  assert.equal(engine.read().available, false);
  media.error = null; media.crossOrigin = null;
  assert.equal(engine.getMixer().available, false);
});

test("selecting a new record can unlock the context before React mounts its audio element", async () => {
  const { context, nodes, element } = audioHarness();
  const engine = analysis.createAudioAnalysis(() => context, origin);
  engine.activate(`${origin}/next.wav`);
  assert.equal(context.resumes, 1);
  await Promise.resolve();
  assert.equal(nodes.length, 0);
  engine.setElement(element(`${origin}/next.wav`));
  engine.activate();
  await Promise.resolve();
  assert.equal(nodes.length, 1);
  engine.dispose();
});

function roomHarness() {
  const frames = [];
  const timers = new Map();
  const listeners = new Map();
  let nextTimer = 0;
  const document = {
    visibilityState: "visible", querySelectorAll: () => frames,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  const scope = {
    document, location: { origin }, innerWidth: 1000, innerHeight: 800,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    getComputedStyle: (frame) => frame.style,
    setInterval: (tick, delay) => { const id = ++nextTimer; timers.set(id, { tick, delay }); return id; },
    clearInterval: (id) => timers.delete(id),
  };
  const addFrame = (src = `${origin}/soundroom/index.html`) => {
    const messages = [];
    const frame = { src, title: "Lowkal Soundroom", isConnected: true,
      style: { display: "block", visibility: "visible", opacity: "1" },
      getBoundingClientRect: () => ({ width: 1000, height: 800, top: 0, bottom: 800, left: 0, right: 1000 }),
      contentWindow: { location: new URL(src), postMessage: (message, target) => messages.push({ message, target }) },
    };
    frames.push(frame);
    return { frame, messages };
  };
  return { scope, frames, timers, listeners, addFrame, tick: () => { for (const timer of timers.values()) timer.tick(); } };
}

test("bridge sends the exact spectrum contract at 30 Hz only to a visible same-origin Soundroom", () => {
  assert.equal(typeof analysis.startAnalysisBridge, "function");
  const room = roomHarness();
  const valid = room.addFrame();
  const external = room.addFrame("https://external.example/soundroom/index.html");
  const otherPage = room.addFrame(`${origin}/unrelated`);
  const navigated = room.addFrame();
  navigated.frame.contentWindow.location = new URL("https://external.example/soundroom/index.html");
  const blocked = room.addFrame();
  Object.defineProperty(blocked.frame.contentWindow, "location", { get() { throw new Error("cross-origin access"); } });
  const data = { bass: 0.2, mid: 0.4, treble: 0.6, level: 0.8, available: true };
  let reads = 0;
  let playing = true;
  const stop = analysis.startAnalysisBridge(room.scope, () => { reads += 1; return data; }, () => playing);
  assert.equal([...room.timers.values()][0].delay, 1000 / 30);
  room.tick();
  assert.ok(reads > 0);
  assert.deepEqual(valid.messages.at(-1), { message: { channel: "lowkal.analysis.v1", type: "spectrum", data }, target: origin });
  for (const target of [external, otherPage, navigated, blocked]) assert.equal(target.messages.length, 0);
  const beforePause = reads;
  playing = false;
  room.tick();
  room.tick();
  assert.equal(reads, beforePause);
  assert.deepEqual(valid.messages.at(-1).message.data, { bass: 0, mid: 0, treble: 0, level: 0, available: false });
  const afterPause = valid.messages.length;
  room.tick();
  assert.equal(valid.messages.length, afterPause, "unavailable status is not a fake 30 Hz stream");
  playing = true;
  valid.frame.style.display = "none";
  room.tick();
  assert.equal(reads, beforePause);
  valid.frame.style.display = "block";
  valid.frame.getBoundingClientRect = () => ({ width: 1000, height: 800, top: 900, bottom: 1700, left: 0, right: 1000 });
  room.tick();
  assert.equal(reads, beforePause, "offscreen rooms do not sample");
  room.scope.document.visibilityState = "hidden";
  room.listeners.get("visibilitychange")();
  assert.equal(room.timers.size, 0, "hidden tabs stop their sampling timer");
  room.scope.document.visibilityState = "visible";
  room.listeners.get("visibilitychange")();
  assert.equal(room.timers.size, 1);
  stop();
  assert.equal(room.timers.size, 0);
  assert.equal(room.listeners.size, 0);
});

test("bridge accepts Vercel clean URLs without accepting unrelated paths", () => {
  const room = roomHarness();
  const valid = room.addFrame();
  valid.frame.contentWindow.location = new URL(`${origin}/soundroom`);
  const data = { bass: 0.2, mid: 0.4, treble: 0.6, level: 0.8, available: true };
  const stop = analysis.startAnalysisBridge(room.scope, () => data, () => true);
  assert.equal(valid.messages.length, 1);
  valid.frame.contentWindow.location = new URL(`${origin}/soundroom-other`);
  room.tick();
  assert.equal(valid.messages.length, 1);
  stop();
});

test("mixer bridge authenticates the current Soundroom and sends source and ready state", async () => {
  const room = roomHarness();
  const valid = room.addFrame();
  valid.frame.contentWindow.location = new URL(`${origin}/soundroom`);
  const other = room.addFrame(`${origin}/other`);
  const navigated = room.addFrame(); navigated.frame.contentWindow.location = new URL(`${origin}/other`);
  const external = room.addFrame("https://external.example/soundroom");
  const detached = room.addFrame(); detached.frame.isConnected = false;
  const { context, element } = audioHarness();
  const engine = analysis.createAudioAnalysis(() => context, origin);
  assert.equal(typeof analysis.startMixerBridge, "function");
  const stop = analysis.startMixerBridge(room.scope, engine);
  const send = (source, command, eventOrigin = origin, channel = "lowkal.mixer.v1") => room.listeners.get("message")({ origin: eventOrigin, source, data: { channel, type: "command", command } });
  send(valid.frame.contentWindow, { action: "request-state" });
  assert.deepEqual(valid.messages.at(-1), { message: { channel: "lowkal.mixer.v1", type: "state", state: { bass: 0, mid: 0, treble: 0, enabled: true, available: false } }, target: origin });
  for (const source of [other.frame.contentWindow, navigated.frame.contentWindow, external.frame.contentWindow, detached.frame.contentWindow, {}, room.scope]) send(source, { action: "set", settings: { bass: 6 } });
  send(valid.frame.contentWindow, { action: "set", settings: { bass: 6 } }, "https://external.example");
  send(valid.frame.contentWindow, { action: "set", settings: { bass: 6 } }, origin, "lowkal.audio.v1");
  assert.equal(engine.getMixer().bass, 0);
  send(valid.frame.contentWindow, { action: "set", settings: { bass: 99, mid: NaN, enabled: false, volume: 0 } });
  assert.equal(valid.messages.at(-1).message.state.bass, 6);
  assert.equal(valid.messages.at(-1).message.state.enabled, false);
  assert.equal(context.resumes, 0, "mixer commands never start playback or capture audio");
  engine.setElement(element());
  assert.equal(valid.messages.at(-1).message.state.available, false);
  engine.activate(); await Promise.resolve();
  assert.equal(valid.messages.at(-1).message.state.available, true);
  engine.setElement(null);
  assert.equal(valid.messages.at(-1).message.state.available, false);
  for (const target of [other, navigated, external, detached]) assert.equal(target.messages.length, 0);
  const count = valid.messages.length;
  stop(); engine.setMixer({ bass: 0 });
  assert.equal(valid.messages.length, count);
  assert.equal(room.listeners.has("message"), false);
});

test("AudioProvider starts and stops the mixer bridge", async () => {
  const provider = await readFile(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /startMixerBridge\(window, getAnalysis\(\), sitePath\("\/soundroom\/index.html"\)\)/);
  assert.match(provider, /stopMixer\(\)/);
});

test("YouTube calls are safe while its iframe API is still loading", async () => {
  const provider = await readFile(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(provider, /youtubePlayerRef\.current\?\.\w+\(/);
});

test("a new keyed audio element receives its source even when two mixes share one URL", async () => {
  const provider = await readFile(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.ok(/audio\.src = activeRecord\.audioUrl;\s*\}, \[activeRecord\.audioUrl, activeRecord\.slug, useYouTube\]\)/.test(provider));
});

test("AudioProvider owns the bridge, sets CORS before src and resumes during playback activation", async () => {
  const provider = await readFile(new URL("../components/AudioProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /from "@\/lib\/audio-analysis"/);
  assert.match(provider, /startAnalysisBridge\(window/);
  assert.match(provider, /isAnalysisSource\(activeRecord\.audioUrl, window\.location\.origin\)/);
  assert.match(provider, /audio\.crossOrigin = "anonymous"[\s\S]*audio\.removeAttribute\("crossorigin"\)[\s\S]*audio\.src = activeRecord\.audioUrl/);
  assert.match(provider, /getAnalysis\(\)\.activate\(\);\s*void audioRef\.current\.play\(\)/);
  assert.match(provider, /shouldPlay && record\?\.audioUrl\) getAnalysis\(\)\.activate\(record\.audioUrl\)/);
  assert.match(provider, /key=\{`\$\{activeRecord\.slug\}:\$\{activeRecord\.audioUrl\}`\} ref=\{bindAudio\}/);
  assert.match(provider, /queueMicrotask[\s\S]*\.dispose\(\)/);
  assert.doesNotMatch(provider, /getUserMedia|captureStream/);
});
