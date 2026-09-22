import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("React mix surfaces copy a route for their own context", async () => {
  const [button, player, archive, artists] = await Promise.all([
    source("components/MixShareButton.tsx"),
    source("components/PersistentPlayer.tsx"),
    source("components/SoundroomCatalog.tsx"),
    source("components/ArtistsDirectory.tsx")
  ]);

  assert.match(button, /variant === "player"[\s\S]*sitePath\(`\/\?mix=\$\{encodedSlug\}`\)[\s\S]*sitePath\(`\/listen\/archive\/\$\{encodedSlug\}`\)/);
  assert.match(button, /navigator\.clipboard\?\.writeText/);
  assert.match(button, /aria-live="polite"/);
  assert.match(player, /variant="player"/);
  assert.match(archive, /variant="archive"/);
  assert.match(artists, /variant="artist"/);
  assert.match(artists, /`\/listen\/archive\/\$\{encodeURIComponent\(record\.slug\)\}`/);
});

test("Soundroom copies its active mix route and provides visible feedback", async () => {
  const [room, styles] = await Promise.all([
    source("public/soundroom/index.html"),
    source("public/soundroom/room.css")
  ]);

  assert.match(room, /id="btn-share-mix"/);
  assert.match(room, /id="btn-share-mix"[\s\S]*?<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(room, /ios_share/);
  assert.match(room, /copyMixLink\(\)/);
  assert.match(room, /listen\?mix=\$\{encodeURIComponent\(this\.activeMix\.id\)\}/);
  assert.match(room, /label\.textContent = 'Copied'/);
  assert.match(styles, /#btn-share-mix \{[^}]*width: 38px;[^}]*border-radius: 50%;/);
  assert.match(styles, /#share-mix-label \{[^}]*clip-path: inset\(50%\);/);
});

test("home and Soundroom links select the requested mix without autoplay", async () => {
  const provider = await source("components/AudioProvider.tsx");

  assert.match(provider, /new URLSearchParams\(window\.location\.search\)\.get\("mix"\)/);
  assert.match(provider, /const requestedRecord = getRecord\(requestedSlug\)/);
  assert.match(provider, /setActiveSlug\(requestedRecord\.slug\); setCurrentTime\(0\); setDuration\(requestedRecord\.duration\)/);
  assert.match(provider, /Selecting a shared mix must not start audio without user input/);
});
