import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const record = (slug, source = true) => ({ slug, artist: slug, series: "Volume", title: slug, duration: 120, artistSlugs: [], genres: [], artwork: "/art.jpg", archiveSection: "volumes-guests", ...(source ? { playback: { provider: "cloudflare", url: "/mix.mp3" } } : {}) });
const records = [record("first"), record("current"), record("unavailable", false)];
function mount(name, overrides = {}) {
  const audio = { activeRecord: records[1], currentTime: 30, duration: 120, isPlaying: false, isReady: false, isLoading: false, error: null, volume: 82, isMuted: false, isShuffled: false, repeatMode: "off", sleepTimer: null, togglePlayback() {}, retryPlayback() {}, playNext() {}, playPrevious() {}, seek() {}, seekBy() {}, setVolume() {}, toggleMuted() {}, toggleShuffle() {}, cycleRepeatMode() {}, setSleepTimer() {}, playRecord() {}, ...overrides };
  const slots = []; let cursor = 0; const effects = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (value) => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useMemo(fn) { return fn(); },
    useEffect(fn) { effects.push(fn); }
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const source = readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id.endsWith("AudioProvider")) return { useAudio: () => audio };
    if (id.endsWith("ListenContentProvider")) return { useListenContent: () => ({ records }) };
    if (id === "next/navigation") return { usePathname: () => "/listen/archive" };
    if (id.endsWith("site-chrome")) return { isUnlistedPath: () => false };
    if (id.endsWith("site-path")) return { sitePath: (path) => path };
    if (id.endsWith("content")) return { formatTime: (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}` };
    return new Proxy({}, { get: (_, key) => key });
  }, compiled, compiled.exports);
  return { audio, effects, render() { cursor = 0; effects.length = 0; return compiled.exports[name](); } };
}
function all(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((node) => all(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)];
}
test("archive follows restored active selection until the listener browses and can return", () => {
  const view = mount("SoundroomCatalog");
  const selected = () => byClass(view.render(), "archive-record").find((node) => node.props["aria-pressed"]);
  assert.match(selected().props["aria-label"], /current/);
  view.audio.activeRecord = records[0];
  assert.match(selected().props["aria-label"], /first/);
  byClass(view.render(), "archive-record")[2].props.onClick();
  view.audio.activeRecord = records[1];
  assert.match(selected().props["aria-label"], /unavailable/);
  const back = all(view.render(), (node) => node.type === "button" && text(node).includes("Return to current"))[0];
  assert.ok(back);
  back.props.onClick();
  assert.match(selected().props["aria-label"], /current/);
});

const text = (tree) => typeof tree === "string" ? tree : Array.isArray(tree) ? tree.map(text).join("") : tree?.props ? text(tree.props.children) : "";
const byClass = (tree, name) => all(tree, (node) => node.props.className?.split(" ").includes(name));

test("mini-player can start before ready and retry an error", () => {
  let retried = false;
  const view = mount("PersistentPlayer", { retryPlayback: () => { retried = true; } });
  assert.equal(byClass(view.render(), "lowkal-player-transport")[0].props.disabled, false);
  view.audio.error = "Connection lost";
  const tree = view.render();
  const button = byClass(tree, "lowkal-player-transport")[0];
  assert.match(button.props["aria-label"], /Retry/);
  button.props.onClick();
  assert.equal(retried, true);
  assert.ok(all(tree, (node) => node.props.role === "status").length);
});

test("seek uses bounded accessible time and requires a ready seekable source", () => {
  const view = mount("PersistentPlayer");
  const seekInput = () => all(byClass(view.render(), "lowkal-player-timeline")[0], (node) => node.type === "input")[0];
  assert.equal(seekInput().props.disabled, true);
  view.audio.isReady = true;
  view.audio.isLoading = true;
  assert.equal(seekInput().props.disabled, false, "buffering alone must not block seeking");
  assert.equal(seekInput().props["aria-valuetext"], "0:30 of 2:00");
  view.audio.currentTime = -10;
  assert.equal(seekInput().props.value, 0);
  view.audio.duration = Infinity;
  assert.ok(Number.isFinite(seekInput().props.max));
  view.audio.duration = 0;
  view.audio.activeRecord = { ...records[1], duration: 0 };
  assert.equal(seekInput().props.disabled, true);
  view.audio.activeRecord = records[2];
  assert.equal(byClass(view.render(), "lowkal-player-transport")[0].props.disabled, true);
  assert.match(text(view.render()), /Unavailable/);
});

test("persistent player preserves the compact production shell", () => {
  const view = mount("PersistentPlayer");
  const tree = view.render();
  const player = byClass(tree, "lowkal-player--compact")[0];
  assert.ok(player, "the production compact player class must remain active");
  for (const className of ["lowkal-player-program", "lowkal-player-title-row", "lowkal-player-title", "lowkal-player-record", "lowkal-player-timecode", "lowkal-player-track", "lowkal-player-room", "lowkal-player-transport-icon"]) {
    assert.ok(byClass(tree, className)[0], `${className} must remain in the compact player`);
  }
  assert.equal(byClass(tree, "lowkal-player-options").length, 0);
  assert.equal(byClass(tree, "lowkal-player-controls").length, 0);
  assert.equal(byClass(tree, "lowkal-player-quick-tools").length, 0);
});

test("timeline previews a scrub and commits one seek when released", () => {
  const seeks = [];
  const view = mount("PersistentPlayer", { isReady: true, seek: (seconds) => seeks.push(seconds) });
  let input = all(byClass(view.render(), "lowkal-player-timeline")[0], (node) => node.type === "input")[0];
  input.props.onChange({ currentTarget: { value: "75" } });
  assert.deepEqual(seeks, []);
  input = all(byClass(view.render(), "lowkal-player-timeline")[0], (node) => node.type === "input")[0];
  input.props.onPointerUp();
  assert.deepEqual(seeks, [75]);
});

test("timeline does not commit a scrub to a newly selected mix", () => {
  const seeks = [];
  const view = mount("PersistentPlayer", { isReady: true, seek: (seconds) => seeks.push(seconds) });
  let input = all(byClass(view.render(), "lowkal-player-timeline")[0], (node) => node.type === "input")[0];
  input.props.onChange({ currentTarget: { value: "75" } });
  view.audio.activeRecord = records[0];
  input = all(byClass(view.render(), "lowkal-player-timeline")[0], (node) => node.type === "input")[0];
  input.props.onPointerUp();
  assert.deepEqual(seeks, []);
});
