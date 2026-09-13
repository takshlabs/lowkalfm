import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Lowkal player timelines use the shared interactive WaveSurfer surface", async () => {
  const waveform = await source("components/AudioWaveform.tsx");
  const player = await source("components/PersistentPlayer.tsx");
  const artists = await source("components/ArtistsDirectory.tsx");

  assert.match(waveform, /from "wavesurfer\.js"/);
  assert.match(waveform, /WaveSurfer\.create/);
  assert.match(waveform, /role="slider"/);
  assert.match(waveform, /onClick=\{handleClick\}/);
  assert.match(waveform, /onSeek\(/);
  assert.match(waveform, /onKeyDown/);
  assert.match(player, /<AudioWaveform/);
  assert.match(artists, /<AudioWaveform/);
  assert.doesNotMatch(player, /type="range"[\s\S]*?Playback position/);
});

test("Soundroom uses WaveSurfer for the source waveform and parent seeking", async () => {
  const room = await source("public/soundroom/index.html");

  assert.match(room, /wavesurfer\.min\.js/);
  assert.match(room, /id="main-waveform"/);
  assert.match(room, /WaveSurfer\.create/);
  assert.match(room, /sendAudioCommand\('seek'/);
  assert.doesNotMatch(room, /id="main-scrubber"/);
});
