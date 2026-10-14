import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { flacInfo } from "../lib/audio-duration.ts";
import { parseWaveformData } from "../lib/waveform-renderer.ts";
import { generateFlacWaveformData } from "../scripts/flac-waveform.mjs";

const available = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const fixture = new Uint8Array(readFileSync(new URL("./fixtures/mix.flac", import.meta.url)));

test("FLAC measurement produces real peaks and frequency bands for the frontend", { skip: !available }, async () => {
  const original = fixture.slice();
  const data = await generateFlacWaveformData(new Blob([fixture]).stream(), flacInfo(fixture), 64);
  assert.equal(data.version, 2);
  assert.equal(data.duration, 0.25);
  assert.equal(data.sampleRate, 44100);
  assert.equal(data.peaks.length, 64);
  assert.ok(data.peaks.some(peak => peak > 0.01));
  for (const values of Object.values(data.bands)) {
    assert.equal(values.length, 64);
    assert.ok(values.some(value => value > 0));
    assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  }
  assert.ok(parseWaveformData(data).bands);
  assert.deepEqual(fixture, original, "measurement does not change the delivery master");
});

test("FLAC measurement rejects an incomplete decode", { skip: !available }, async () => {
  await assert.rejects(generateFlacWaveformData(new Blob([fixture.slice(0, 42)]).stream(), flacInfo(fixture)), /Incomplete WAV data|FLAC decoder failed/);
});

test("an unknown FLAC sample count cancels the download before measurement", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(generateFlacWaveformData(stream, { sampleRate: 44100, channels: 1, totalSamples: 0 }), /sample count/);
  assert.equal(cancelled, true);
});
