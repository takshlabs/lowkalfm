import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { durationSecondsFromAudio, durationSecondsFromFlac, durationSecondsFromWav, flacInfo, readStreamPrefix } from "../lib/audio-duration.ts";

test("FLAC duration reads STREAMINFO without decoding audio", () => {
  const bytes = new Uint8Array(readFileSync(new URL("./fixtures/mix.flac", import.meta.url)));
  assert.deepEqual(flacInfo(bytes), { sampleRate: 44100, totalSamples: 11025, channels: 1, bits: 16 });
  assert.equal(durationSecondsFromAudio(bytes), 1);
  assert.equal(durationSecondsFromAudio(wavHeader()), 2);
  assert.equal(durationSecondsFromFlac(bytes.subarray(0, 41)), undefined);
  const header = bytes.slice(0, 42);
  header[21] = (header[21] & 0xf0) | 1;
  new DataView(header.buffer).setUint32(22, 44100 * 90);
  assert.equal(flacInfo(header).totalSamples, 4294967296 + 44100 * 90);
  header[21] &= 0xf0;
  assert.equal(durationSecondsFromFlac(header), 90);
  header.fill(0, 22, 26);
  assert.equal(durationSecondsFromFlac(header), undefined, "unknown sample count has no header duration");
  header[7] = 33;
  assert.equal(flacInfo(header), undefined, "invalid STREAMINFO length is rejected");
  header[7] = 34;
  header.fill(0, 18, 20);
  header[20] &= 15;
  assert.equal(flacInfo(header), undefined, "zero sample rate is rejected");
});

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
