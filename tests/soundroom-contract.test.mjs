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
  assert.doesNotMatch(player, /Live signal/i);
  assert.doesNotMatch(player, /player-signal/);
});

test("the isolated Soundroom provides routes back to Lowkal, Read, and Go Out", async () => {
  const soundroom = await source("public/soundroom/index.html");

  assert.match(soundroom, /href="\.\.\/"[^>]*>\s*Back to home/i);
  assert.match(soundroom, /href="\.\.\/read"[^>]*>\s*Read/i);
  assert.match(soundroom, /href="\.\.\/go-out"[^>]*>\s*Go out/i);
});

test("semantic React images use Lowkal's shared media frame", async () => {
  const files = [
    "components/HomeListenModule.tsx",
    "components/SoundroomCatalog.tsx",
    "components/PersistentPlayer.tsx",
  ];

  for (const path of files) {
    const content = await source(path);
    assert.match(content, /MediaFrame/);
    assert.doesNotMatch(content, /from "next\/image"/);
  }
});

test("the original Soundroom opens the native Three.js archive room", async () => {
  const page = await source("app/listen/page.tsx");
  const archivePage = await source("app/listen/archive/page.tsx");
  const soundroom = await source("public/soundroom/index.html");
  const catalog = await source("components/SoundroomCatalog.tsx");
  const scene = await source("components/SoundroomScene.tsx");

  assert.match(page, /<iframe/);
  assert.match(page, /soundroom\/index\.html/);
  assert.match(soundroom, /href="\.\.\/listen\/archive"[^>]*target="_top"/i);
  assert.match(archivePage, /SoundroomCatalog/);
  assert.match(catalog, /Lowkal scene broadcast/i);
  assert.match(catalog, /Lowkal FM volumes/i);
  assert.match(catalog, /Residents/i);
  assert.match(catalog, /Guests/i);
  assert.match(scene, /ArchiveRoom/);
  assert.match(scene, /RecordShelf/);
  assert.match(scene, /CameraRig/);
});
