import assert from "node:assert/strict";
import test from "node:test";
import { parseRekordboxCueFile } from "../lib/cue-tracklist.ts";

test("Rekordbox CUE files create tracks in order with INDEX 01 times", () => {
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
    { time: 0, title: "First Track", artist: "Maya K" },
    { time: 223, title: "Second Track", artist: "Nila" }
  ]);
});

test("CUE import uses a disc performer and can split artist and title", () => {
  const cue = `PERFORMER "Nila"
TRACK 01 AUDIO
TITLE "First Track"
INDEX 01 00:00:00
TRACK 02 AUDIO
TITLE "Maya K - Second Track"
INDEX 01 00:05:38`;

  assert.deepEqual(parseRekordboxCueFile(cue), [
    { time: 0, title: "First Track", artist: "Nila" },
    { time: 6, title: "Second Track", artist: "Maya K" }
  ]);
});

test("CUE import rejects tracks without a start time or artist", () => {
  assert.throws(
    () => parseRekordboxCueFile('TRACK 01 AUDIO\nTITLE "First Track"\nPERFORMER "Maya K"'),
    /no INDEX 01 start time/
  );
  assert.throws(
    () => parseRekordboxCueFile('TRACK 01 AUDIO\nTITLE "First Track"\nINDEX 01 00:00:00'),
    /no artist was found/
  );
});
