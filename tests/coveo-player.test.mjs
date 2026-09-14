import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const record = (slug, source = true) => ({
  slug,
  artist: "Test Artist",
  series: "Episode 1",
  title: "Just a Memory",
  duration: 90,
  artistSlugs: ["test-artist"],
  genres: ["Ambient"],
  artwork: "/art.jpg",
  archiveSection: "volumes-guests",
  ...(source ? { playback: { provider: "cloudflare", url: "/mix.mp3" }, waveformPeaksUrl: "/mix.peaks.json" } : {})
});

function mountPersistentPlayer(overrides = {}) {
  const audio = {
    activeRecord: record("test-mix"),
    currentTime: 15,
    duration: 90,
    isPlaying: false,
    isReady: true,
    isLoading: false,
    error: null,
    volume: 75,
    togglePlayback() {},
    retryPlayback() {},
    seek() {},
    setVolume() {},
    ...overrides
  };
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      slots[i] ??= { current: initial };
      return slots[i];
    },
    useMemo(fn) { return fn(); },
    useEffect() {}
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const source = readFileSync(new URL("../components/PersistentPlayer.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id.endsWith("AudioProvider")) return { useAudio: () => audio };
    if (id === "next/navigation") return { usePathname: () => "/" };
    if (id.endsWith("site-chrome")) return { isUnlistedPath: () => false };
    if (id.endsWith("site-path")) return { sitePath: (path) => path };
    if (id.endsWith("content")) return { formatTime: (s) => `00:${String(Math.floor(s)).padStart(2, "0")}` };
    return new Proxy({}, { get: (_, key) => key });
  }, compiled, compiled.exports);

  return {
    audio,
    render() {
      cursor = 0;
      return compiled.exports.PersistentPlayer();
    }
  };
}

function all(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => all(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}

const byClass = (tree, name) => all(tree, (node) => node.props?.className?.split(" ").includes(name));

test("Coveo mini player renders complete track details, vinyl record, and transport controls", () => {
  const view = mountPersistentPlayer();
  const tree = view.render();

  assert.ok(byClass(tree, "lowkal-coveo-mini")[0], "Mini player container exists");
  assert.ok(byClass(tree, "coveo-track-info")[0], "Track info container exists");
  assert.ok(byClass(tree, "coveo-status-label")[0], "Status label exists");
  assert.ok(byClass(tree, "coveo-track-title")[0], "Track title link exists");

  assert.ok(byClass(tree, "coveo-record-container")[0], "Vinyl record container exists");
  assert.ok(byClass(tree, "coveo-record-offset")[0], "Vinyl record offset exists");
  assert.ok(byClass(tree, "coveo-record")[0], "Vinyl record disc exists");
  assert.ok(byClass(tree, "coveo-record-artwork")[0], "Vinyl record center artwork label exists");
  assert.ok(byClass(tree, "coveo-spindle-outer")[0], "Spindle hole outer ring exists");
  assert.ok(byClass(tree, "coveo-spindle-inner")[0], "Spindle hole inner center exists");

  assert.ok(byClass(tree, "coveo-track-controls")[0], "Track controls container exists");
  assert.ok(byClass(tree, "coveo-timecode")[0], "Timecode display exists");
  assert.ok(byClass(tree, "coveo-audio-button")[0], "Audio transport button exists");
  assert.equal(byClass(tree, "coveo-bar").length, 4, "Four animated equalizer bars exist");
  assert.ok(byClass(tree, "coveo-expand-button")[0], "Expand button exists");
});

test("Expand and collapse toggle between mini player and expanded wider player", () => {
  const view = mountPersistentPlayer();
  let tree = view.render();

  assert.ok(tree.props.className.includes("is-mini"));
  assert.ok(!tree.props.className.includes("is-expanded"));

  const expandBtn = byClass(tree, "coveo-expand-button")[0];
  assert.ok(expandBtn, "Expand button exists");
  expandBtn.props.onClick();

  tree = view.render();
  assert.ok(tree.props.className.includes("is-expanded"), "Player expands to wider deck");

  const collapseBtn = byClass(tree, "lowkal-player-collapse")[0];
  assert.ok(collapseBtn, "Collapse button exists in expanded player");
  collapseBtn.props.onClick();

  tree = view.render();
  assert.ok(tree.props.className.includes("is-mini"), "Player collapses back to mini player");
});

test("Coveo player stylesheet includes vinyl grooves, equalizer animation, and responsive layout", () => {
  const css = readFileSync(new URL("../app/coveo-player.css", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(layout, /coveo-player\.css/);
  assert.match(css, /radial-gradient/);
  assert.match(css, /coveoRecordSpin/);
  assert.match(css, /coveoEqualizerBars/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
