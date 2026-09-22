import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("React mix surfaces copy the canonical mix route", async () => {
  const [button, player, archive, artists] = await Promise.all([
    source("components/MixShareButton.tsx"),
    source("components/PersistentPlayer.tsx"),
    source("components/SoundroomCatalog.tsx"),
    source("components/ArtistsDirectory.tsx")
  ]);

  assert.match(button, /`\/listen\/archive\/\$\{encodeURIComponent\(slug\)\}`/);
  assert.match(button, /navigator\.clipboard\?\.writeText/);
  assert.match(button, /aria-live="polite"/);
  assert.match(player, /variant="player"/);
  assert.match(archive, /variant="archive"/);
  assert.match(artists, /variant="artist"/);
  assert.match(artists, /`\/listen\/archive\/\$\{encodeURIComponent\(record\.slug\)\}`/);
});

test("Soundroom copies its active mix route and provides visible feedback", async () => {
  const room = await source("public/soundroom/index.html");

  assert.match(room, /id="btn-share-mix"/);
  assert.match(room, /copyMixLink\(\)/);
  assert.match(room, /listen\/archive\/\$\{encodeURIComponent\(this\.activeMix\.id\)\}/);
  assert.match(room, /label\.textContent = 'Copied'/);
});
