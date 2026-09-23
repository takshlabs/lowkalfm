import assert from "node:assert/strict";
import test from "node:test";
import { parseRekordboxCueFile } from "../lib/cue-tracklist.ts";

test("Rekordbox CUE files create untimed tracks in order", () => {
  const cue = `\uFEFFPERFORMER "Lowkal FM"
FILE "Lowkal Recording.wav" WAVE
  TRACK 01 AUDIO
    TITLE "First Track"
    PERFORMER "Maya K"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Second Track"
    PERFORMER "Nila"
    INDEX 01 03:42:38`;

  assert.deepEqual(parseRekordboxCueFile(cue), [
    { title: "First Track", artist: "Maya K" },
    { title: "Second Track", artist: "Nila" }
  ]);
});

test("CUE import ignores a disc performer and can split artist and title", () => {
  const cue = `PERFORMER "Takezo"
TRACK 01 AUDIO
TITLE "First Track"
TRACK 02 AUDIO
TITLE "Maya K - Second Track"`;

  assert.deepEqual(parseRekordboxCueFile(cue), [
    { title: "First Track" },
    { title: "Second Track", artist: "Maya K" }
  ]);
});

test("CUE import keeps tracks without an artist", () => {
  assert.deepEqual(
    parseRekordboxCueFile('TRACK 01 AUDIO\nTITLE "First Track"'),
    [{ title: "First Track" }]
  );
});
