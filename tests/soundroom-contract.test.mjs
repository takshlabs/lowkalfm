import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the floating player preserves its live state during client navigation and supports direct audio with YouTube fallback", async () => {
  const provider = await source("components/AudioProvider.tsx");
  const content = await source("components/ListenContentProvider.tsx");
  const query = await source("lib/sanity.ts");
  const player = await source("components/PersistentPlayer.tsx");

  assert.match(provider, /HTMLAudioElement/);
  assert.match(provider, /<audio/);
  assert.match(provider, /youtube\.com\/iframe_api/);
  assert.match(provider, /youtubeId/);
  assert.match(provider, /activeRecord\.startOffset/);
  assert.match(provider, /resumeAtRef\.current = record\?\.startOffset/);
  assert.match(provider, /failedAudioUrl === activeRecord\.audioUrl/);
  assert.match(provider, /setFailedAudioUrl\(activeRecord\.audioUrl/);
  assert.match(content, /resolveMixPlayback\(\{ deliveryUrl: mix\.audioDeliveryUrl, masterUrl: mix\.audioMasterUrl, externalUrl: mix\.externalUrl \}\)/);
  assert.match(content, /\.\.\.playback/);
  assert.match(query, /externalUrl/);
  assert.doesNotMatch(provider, /react-youtube/);
  assert.match(provider, /const \[isPlaying, setIsPlaying\] = useState\(false\)/);
  assert.match(provider, /const autoplayRef = useRef\(false\)/);
  assert.match(player, /onInput=\{\(event\) => seek\(Number\(event\.currentTarget\.value\)\)\}/);
  assert.doesNotMatch(provider, /lowkal\.player\.playback-intent\.v1/);
  assert.doesNotMatch(provider, /sessionStorage/);
  assert.doesNotMatch(player, /Live signal/i);
  assert.doesNotMatch(player, /player-signal/);
});

test("internal navigation keeps the root audio provider mounted", async () => {
  const link = await source("components/SiteLink.tsx");
  const layout = await source("app/layout.tsx");
  const readFeed = await source("components/ReadFeed.tsx");
  const soundroomFrame = await source("components/SoundroomFrame.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.match(link, /from "next\/link"/);
  assert.match(link, /<Link href=\{href\}/);
  assert.match(layout, /<AudioProvider>[\s\S]*?\{children\}[\s\S]*?<PersistentPlayer/);
  assert.match(readFeed, /<SiteLink href=\{`\/read\/\$\{story\.slug\}`\}/);
  assert.match(soundroomFrame, /useRouter/);
  assert.match(soundroomFrame, /router\.push/);
  assert.doesNotMatch(soundroomFrame, /window\.location\.assign/);
  assert.match(soundroomFrame, /event\.source !== frameRef\.current\?\.contentWindow/);
  assert.match(soundroom, /bindNavigationBridge/);
  assert.match(soundroom, /lowkal\.navigation\.v1/);
});

test("the isolated Soundroom provides routes back to Lowkal, Read, and Go Out", async () => {
  const soundroom = await source("public/soundroom/index.html");

  assert.match(soundroom, /href="\.\.\/"[^>]*>\s*Back to home/i);
  assert.match(soundroom, /href="\.\.\/read"[^>]*>\s*Read/i);
  assert.match(soundroom, /href="\.\.\/go-out"[^>]*>\s*Go out/i);
});

test("semantic React images use Lowkal's shared media frame", async () => {
  const files = [
    "components/HomeTransmissionDeck.tsx",
    "components/PersistentPlayer.tsx",
  ];

  for (const path of files) {
    const content = await source(path);
    assert.match(content, /MediaFrame/);
    assert.doesNotMatch(content, /from "next\/image"/);
  }

  const archive = await source("components/SoundroomCatalog.tsx");
  assert.match(archive, /archive-vinyl-label/);
  assert.match(archive, /<Image/);
});

test("the original Soundroom opens the vinyl-and-shader archive room", async () => {
  const page = await source("app/listen/page.tsx");
  const frame = await source("components/SoundroomFrame.tsx");
  const archivePage = await source("app/listen/archive/page.tsx");
  const soundroom = await source("public/soundroom/index.html");
  const catalog = await source("components/SoundroomCatalog.tsx");
  const atmosphere = await source("components/ArchiveAtmosphere.tsx");

  assert.match(page, /<SoundroomFrame/);
  assert.match(frame, /<iframe/);
  assert.match(frame, /soundroom\/index\.html/);
  assert.match(soundroom, /href="\.\.\/listen\/archive"[^>]*target="_top"/i);
  assert.match(archivePage, /SoundroomCatalog/);
  assert.match(catalog, /Lowkal scene programme/i);
  assert.match(catalog, /Lowkal FM resident volumes/i);
  assert.match(catalog, /Lowkal FM guest volumes/i);
  assert.match(catalog, /Residents/i);
  assert.match(catalog, /Guests/i);
  assert.match(catalog, /ArchiveAtmosphere/);
  assert.match(atmosphere, /fragmentShaderSource/);
  assert.match(atmosphere, /prefers-reduced-motion/);
});

test("each mix can control the Soundroom shader palette", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");
  const provider = await source("components/ListenContentProvider.tsx");
  const frame = await source("components/SoundroomFrame.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.match(schema, /name:\s*"shaderMoodPrompt"/);
  assert.match(query, /shaderMoodPrompt/);
  assert.match(provider, /shaderMoodPrompt:\s*mix\.shaderMoodPrompt/);
  assert.match(frame, /shaderMoodPrompt:\s*record\.shaderMoodPrompt/);
  assert.match(soundroom, /function shaderPaletteForMix\(mix\)/);
  assert.match(soundroom, /window\.resolveSoundroomShaderPalette\s*=\s*shaderPaletteForMix/);
  assert.match(soundroom, /dataset\.moodPalette\s*=\s*paletteName/);
  assert.match(soundroom, /applyShaderMood\(mix\)/);
  assert.match(soundroom, /u_paletteBase/);
  assert.match(soundroom, /u_paletteAccent/);
});

test("Soundroom displays CMS tracklists and plain-text mix descriptions", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");
  const frame = await source("components/SoundroomFrame.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.match(schema, /name:\s*"tracks"/);
  assert.match(schema, /title:\s*"Tracklist"/);
  assert.match(query, /tracks\[\]\{time, title, artist\}/);
  assert.match(frame, /tracks:\s*record\.tracks/);
  assert.match(soundroom, /btn-tracklist-open/);
  assert.match(soundroom, /modal-tracklist/);
  assert.match(soundroom, /renderTracklist\(mix\)/);
  assert.match(soundroom, /detail-mix-description.*hidden = !description/s);
  assert.doesNotMatch(soundroom, /id="detail-mix-desc"[^>]*\bitalic\b/);
});

test("CMS YouTube video links only open video buttons and never control audio playback", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");
  const content = await source("components/ListenContentProvider.tsx");
  const player = await source("components/PersistentPlayer.tsx");
  const audio = await source("components/AudioProvider.tsx");
  const frame = await source("components/SoundroomFrame.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.match(schema, /name:\s*"youtubeVideoUrl"/);
  assert.match(schema, /Display only/);
  assert.match(query, /youtubeVideoUrl/);
  assert.match(content, /youtubeVideoUrl:\s*getYouTubeVideoUrl\(mix\.youtubeVideoUrl\)/);
  assert.match(player, /activeRecord\.youtubeVideoUrl/);
  assert.match(player, /aria-label="Watch this mix on YouTube"/);
  assert.match(frame, /youtubeVideoUrl:\s*record\.youtubeVideoUrl/);
  assert.match(soundroom, /id="main-youtube-video"/);
  assert.match(soundroom, /id="mini-youtube-video"/);
  assert.match(soundroom, /videoLink\.href = mix\.youtubeVideoUrl/);
  assert.match(soundroom, /videoLink\.hidden = !mix\.youtubeVideoUrl/);
  assert.doesNotMatch(audio, /youtubeVideoUrl/);
  assert.match(content, /resolveMixPlayback\(\{ deliveryUrl: mix\.audioDeliveryUrl, masterUrl: mix\.audioMasterUrl, externalUrl: mix\.externalUrl \}\)/);
});

test("the floating player and embedded Soundroom use one audio authority", async () => {
  const provider = await source("components/AudioProvider.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.match(provider, /lowkal\.audio\.v1/);
  assert.match(provider, /request-state/);
  assert.match(provider, /event\.origin !== window\.location\.origin/);
  assert.match(provider, /audio\?\.currentTime/);
  assert.match(provider, /youtubePlayerRef\.current\?\.getCurrentTime/);
  assert.match(provider, /action === "select"/);
  assert.match(provider, /action === "seek-by"/);
  assert.match(provider, /audioRef\.current\?\.currentTime/);

  assert.match(soundroom, /lowkal\.audio\.v1/);
  assert.match(soundroom, /IS_EMBEDDED = window\.parent !== window/);
  assert.match(soundroom, /sendAudioCommand\('seek'/);
  assert.match(soundroom, /sendAudioCommand\('seek-by', \{ seconds \}\)/);
  assert.match(soundroom, /sendAudioCommand\('volume'/);
  assert.match(soundroom, /applyExternalAudioState/);
  assert.match(soundroom, /mix\.id === state\.slug/);
  assert.match(soundroom, /mix\.audioUrl \|\| mix\.youtubeId/);
  assert.match(soundroom, /Only the parent can make sound/);
  assert.match(soundroom, /HtmlAudioPlayerEngine/);
});

test("Soundroom keeps playback controls in the player card, not on the artwork", async () => {
  const soundroom = await source("public/soundroom/index.html");

  assert.doesNotMatch(soundroom, /btn-main-play-art|icon-main-play-art/);
  assert.match(soundroom, /id="btn-main-play"/);
});

test("phone playback stays on the native media path and exposes system controls", async () => {
  const provider = await source("components/AudioProvider.tsx");

  assert.match(provider, /needsNativeBackgroundAudio/);
  assert.match(provider, /pointer: coarse/);
  assert.match(provider, /if \(!needsNativeBackgroundAudio\(\)\) getAnalysis\(\)\.activate\(\)/);
  assert.match(provider, /previoustrack/);
  assert.match(provider, /nexttrack/);
  assert.match(provider, /seekbackward/);
  assert.match(provider, /seekforward/);
  assert.match(provider, /setPositionState/);
  assert.match(provider, /session\.playbackState = isPlaying \? "playing" : "paused"/);
  assert.match(provider, /preload="auto"/);
});


async function settingsHarness() {
  const { runInNewContext } = await import('node:vm');
  const elements = new Map();
  const documentEvents = {};
  const windowEvents = {};
  const messages = [];
  const document = {
    activeElement: null,
    documentElement: { dataset: {} },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        id, hidden: id === 'modal-settings', inert: false, disabled: false, value: '0', textContent: '', isConnected: true, events: {}, attrs: {},
        addEventListener(type, fn) { this.events[type] = fn; },
        setAttribute(key, value) { this.attrs[key] = value; },
        focus() { document.activeElement = this; },
        getClientRects() { return [1]; },
        contains(element) { return element?.id !== 'btn-settings-open'; },
        querySelectorAll() { return [...elements.values()].filter(e => (e.id === 'btn-settings-close' || e.id === 'mixer-master') && !e.disabled); }
      });
      return elements.get(id);
    },
    querySelectorAll() { return [this.getElementById('background')]; },
    addEventListener(type, fn) { documentEvents[type] = fn; }
  };
  const parent = { postMessage: (message, origin) => messages.push({ message: JSON.parse(JSON.stringify(message)), origin }) };
  const window = { parent, location: { origin: 'https://example.com' }, addEventListener: (type, fn) => { windowEvents[type] = fn; } };
  runInNewContext(await source('public/soundroom/room-settings.js'), { window, document, console });
  const get = id => document.getElementById(id);
  const send = (channel, state, overrides = {}) => windowEvents.message({ source: parent, origin: window.location.origin, data: { channel, type: 'state', state }, ...overrides });
  return { get, send, messages, document, documentEvents };
}

test('settings uses the parent mixer protocol and keeps master available without EQ', async () => {
  const { get, send, messages } = await settingsHarness();
  assert.ok(messages.some(({message, origin}) => message.channel === 'lowkal.mixer.v1' && message.command.action === 'request-state' && origin === 'https://example.com'));
  assert.equal(get('mixer-bass').disabled, true);
  assert.equal(get('mixer-master').disabled, false);
  send('lowkal.mixer.v1', { available: true, enabled: true, bass: 3, mid: -2, treble: 1 }, { origin: 'https://evil.test' });
  assert.equal(get('mixer-bass').disabled, true);
  send('lowkal.mixer.v1', { available: true, enabled: true, bass: 3, mid: -2, treble: 1 }, { source: {} });
  assert.equal(get('mixer-bass').disabled, true);
  send('lowkal.mixer.v1', { available: true, enabled: true, bass: 3, mid: -2, treble: 1 });
  assert.equal(get('mixer-bass').disabled, false);
  assert.equal(Number(get('mixer-bass').value), 3);
  get('mixer-mid').value = '-5';
  get('mixer-mid').events.input({ target: get('mixer-mid') });
  assert.deepEqual(messages.at(-1).message, { channel: 'lowkal.mixer.v1', type: 'command', command: { action: 'set', settings: { bass: 3, mid: -5, treble: 1, enabled: true } } });
  get('mixer-bypass').events.click();
  assert.equal(messages.at(-1).message.command.settings.enabled, false);
  get('mixer-reset').events.click();
  assert.deepEqual(messages.at(-1).message.command.settings, { bass: 0, mid: 0, treble: 0, enabled: true });
  send('lowkal.mixer.v1', { available: false, enabled: true, bass: 0, mid: 0, treble: 0 });
  assert.equal(get('mixer-bass').disabled, true);
  assert.match(get('mixer-status').textContent, /unavailable/i);
  send('lowkal.audio.v1', { volume: 37 });
  assert.equal(Number(get('mixer-master').value), 37);
  get('mixer-master').value = '42';
  get('mixer-master').events.input({ target: get('mixer-master') });
  assert.deepEqual(messages.at(-1).message, { channel: 'lowkal.audio.v1', type: 'command', command: { action: 'volume', volume: 42 } });
});

test('settings opens, traps keyboard focus, closes and restores focus', async () => {
  const { get, document, documentEvents } = await settingsHarness();
  get('btn-settings-open').focus();
  get('btn-settings-open').events.click();
  assert.equal(get('modal-settings').hidden, false);
  assert.equal(get('background').inert, true);
  assert.equal(document.activeElement.id, 'btn-settings-close');
  let prevented = false;
  documentEvents.keydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement.id, 'mixer-master');
  documentEvents.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(get('modal-settings').hidden, true);
  assert.equal(document.activeElement.id, 'btn-settings-open');
  assert.equal(get('background').inert, false);
  get('btn-settings-open').events.click();
  get('modal-settings').events.click({ target: get('modal-settings') });
  assert.equal(get('modal-settings').hidden, true);
  get('btn-settings-open').events.click();
  get('btn-settings-close').events.click();
  assert.equal(get('modal-settings').hidden, true);
});

test('settings ignores a click that lands after another modal closes', async () => {
  const { get, document } = await settingsHarness();
  let prevented = false;
  let stopped = false;
  document.documentElement.dataset.lowkalModalDismissalUntil = String(Date.now() + 1_000);
  get('btn-settings-open').events.click({
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; }
  });
  assert.equal(get('modal-settings').hidden, true);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test('tracklist close button is a button and sets the settings click guard', async () => {
  const soundroom = await source('public/soundroom/index.html');
  assert.match(soundroom, /id="btn-tracklist-close"\s+type="button"/);
  assert.match(soundroom, /lowkalModalDismissalUntil = String\(Date\.now\(\) \+ 1_000\)/);
});
