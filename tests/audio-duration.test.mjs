import assert from "node:assert/strict";
import test from "node:test";
import { durationSecondsFromWav, readStreamPrefix } from "../lib/audio-duration.ts";

function wavHeader({ byteRate = 176400, dataBytes = 352800 } = {}) {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const write = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
}

test("WAV headers report duration in whole seconds", () => {
  assert.equal(durationSecondsFromWav(wavHeader()), 2);
  assert.equal(durationSecondsFromWav(wavHeader({ byteRate: 176400, dataBytes: 176400 * 90 })), 90);
  assert.equal(durationSecondsFromWav(new Uint8Array([82, 73, 70, 70])), undefined);
  assert.equal(durationSecondsFromWav(new Uint8Array()), undefined);
});

test("WAV duration can fall back to the full file size when the data chunk is absent", () => {
  const header = wavHeader({ byteRate: 176400, dataBytes: 176400 });
  header.set(new TextEncoder().encode("LIST"), 36);
  assert.equal(durationSecondsFromWav(header.slice(0, 36), 44 + 176400), 1);
});

test("stream prefix reads a bounded header and cancels the remainder", async () => {
  const bytes = new Uint8Array(200);
  bytes.fill(7);
  const prefix = await readStreamPrefix(new Blob([bytes]).stream(), 64);
  assert.equal(prefix.byteLength, 64);
  assert.equal(prefix[0], 7);
  assert.equal(prefix[63], 7);
});
