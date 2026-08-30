import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the floating player is quiet by default and does not advertise a live signal", async () => {
  const provider = await source("components/AudioProvider.tsx");
  const player = await source("components/PersistentPlayer.tsx");

  assert.match(provider, /autoplay:\s*0/);
  assert.match(provider, /const \[isPlaying, setIsPlaying\] = useState\(false\)/);
  assert.match(provider, /PLAYBACK_INTENT_KEY/);
  assert.match(provider, /window\.sessionStorage\.getItem\(PLAYBACK_INTENT_KEY\) === "playing"/);
  assert.match(provider, /window\.sessionStorage\.setItem\(PLAYBACK_INTENT_KEY, shouldPlay \? "playing" : "paused"\)/);
  assert.doesNotMatch(player, /Live signal/i);
  assert.doesNotMatch(player, /player-signal/);
});

test("internal navigation uses stable document links", async () => {
  const link = await source("components/SiteLink.tsx");
  const layout = await source("app/layout.tsx");
  const readFeed = await source("components/ReadFeed.tsx");
  const soundroomFrame = await source("components/SoundroomFrame.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.doesNotMatch(link, /next\/link/);
  assert.match(link, /<a href=\{href\}/);
  assert.match(layout, /<AudioProvider>[\s\S]*?\{children\}[\s\S]*?<PersistentPlayer/);
  assert.match(readFeed, /<SiteLink href=\{`\/read\/\$\{story\.slug\}`\}/);
  assert.match(soundroomFrame, /window\.location\.assign/);
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
    "components/HomeStage.tsx",
    "components/HomeSessionShelf.tsx",
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

test("the floating player and embedded Soundroom use one audio authority", async () => {
  const provider = await source("components/AudioProvider.tsx");
  const soundroom = await source("public/soundroom/index.html");

  assert.match(provider, /lowkal\.audio\.v1/);
  assert.match(provider, /request-state/);
  assert.match(provider, /event\.origin !== window\.location\.origin/);
  assert.match(provider, /getCurrentTime/);
  assert.match(provider, /action === "select"/);

  assert.match(soundroom, /lowkal\.audio\.v1/);
  assert.match(soundroom, /IS_EMBEDDED = window\.parent !== window/);
  assert.match(soundroom, /sendAudioCommand\('seek'/);
  assert.match(soundroom, /sendAudioCommand\('volume'/);
  assert.match(soundroom, /applyExternalAudioState/);
  assert.match(soundroom, /Only the parent can make sound/);
  assert.match(soundroom, /if \(IS_EMBEDDED\) return;\s*if \(window\._appInstance\)/);
});
