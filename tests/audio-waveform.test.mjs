import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Lowkal player timelines use the shared measured spectrum surface", async () => {
  const waveform = await source("components/AudioWaveform.tsx");
  const player = await source("components/PersistentPlayer.tsx");
  const artists = await source("components/ArtistsDirectory.tsx");

  assert.match(waveform, /from "@\/lib\/waveform-renderer"/);
  assert.match(waveform, /createSpectrumWaveform/);
  assert.match(waveform, /fetch\(peaksUrl/);
  assert.match(waveform, /waveform.setData\(payload\)/);
  assert.match(waveform, /role="slider"/);
  assert.match(waveform, /canSeek: \(\) => controlRef.current.canSeek/);
  assert.match(waveform, /current.onSeek\(seconds\)/);
  assert.match(waveform, /onKeyDown/);
  assert.match(player, /<AudioWaveform/);
  assert.match(artists, /<AudioWaveform/);
  assert.doesNotMatch(player, /type="range"[\s\S]*?Playback position/);
  assert.doesNotMatch(waveform, /url:\s*sourceUrl/);
});

test("Soundroom uses the shared renderer for the measured waveform and parent seeking", async () => {
  const room = await source("public/soundroom/index.html");

  assert.match(room, /waveform-renderer\.js/);
  assert.match(room, /id="main-waveform"/);
  assert.match(room, /LowkalWaveform.createSpectrumWaveform/);
  assert.match(room, /fetch\(peaksUrl,/);
  assert.match(room, /waveform.setData\(payload\)/);
  assert.match(room, /sendAudioCommand\('seek'/);
  assert.doesNotMatch(room, /id="main-scrubber"/);
});
