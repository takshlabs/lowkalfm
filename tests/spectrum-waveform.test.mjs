import assert from "node:assert/strict";
import test from "node:test";
import { generateWaveformData, wavInfo } from "../lib/waveform-data.ts";
import { parseWaveformData, aggregateWaveform, timeFromProgress } from "../lib/waveform-renderer.ts";
import { readMasterInRanges } from "../lib/waveform-source.ts";

function wav(frequency = 100, { channels = 1, bits = 16, floating = false, opposite = false } = {}) {
  const rate = 48000, frames = 9600, align = channels * bits / 8;
  const bytes = new Uint8Array(44 + frames * align), view = new DataView(bytes.buffer);
  const text = (offset, value) => bytes.set(new TextEncoder().encode(value), offset);
  text(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, floating ? 3 : 1, true); view.setUint16(22, channels, true); view.setUint32(24, rate, true); view.setUint32(28, rate * align, true); view.setUint16(32, align, true); view.setUint16(34, bits, true); text(36, "data"); view.setUint32(40, frames * align, true);
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) {
    const value = .7 * Math.sin(frame * frequency * 2 * Math.PI / rate) * (opposite && channel ? -1 : 1);
    const offset = 44 + frame * align + channel * bits / 8;
    if (floating) view.setFloat32(offset, value, true);
    else if (bits === 16) view.setInt16(offset, value * 32767, true);
    else if (bits === 32) view.setInt32(offset, value * 2147483647, true);
    else { const integer = Math.round(value * 8388607); bytes[offset] = integer & 255; bytes[offset + 1] = integer >> 8 & 255; bytes[offset + 2] = integer >> 16 & 255; }
  }
  return bytes;
}
function stream(bytes, chunkSize = 8192) {
  let offset = 0;
  return new ReadableStream({ pull(controller) { if (offset >= bytes.length) controller.close(); else { controller.enqueue(bytes.slice(offset, offset + chunkSize)); offset += chunkSize; } } });
}
const average = values => values.reduce((sum, v) => sum + v, 0) / values.length;

test("measured lanes distinguish bass, mid, and high tones", async () => {
  for (const [frequency, band] of [[80, "bass"], [900, "mids"], [10000, "highs"]]) {
    const bytes = wav(frequency), data = await generateWaveformData(stream(bytes), wavInfo(bytes), 64);
    const levels = Object.fromEntries(Object.entries(data.bands).map(([name, values]) => [name, average(values.slice(4))]));
    for (const other of Object.keys(levels).filter(name => name !== band)) assert.ok(levels[band] > levels[other] * 1.5, JSON.stringify({ frequency, levels }));
    assert.equal(data.peaks.length, 64); assert.equal(data.duration, .2); parseWaveformData(data);
  }
});
test("chunk boundaries and opposite stereo phases preserve measured energy", async () => {
  const bytes = wav(900, { channels: 2, opposite: true, bits: 24 });
  const whole = await generateWaveformData(stream(bytes, bytes.length), wavInfo(bytes), 32);
  const chunks = await generateWaveformData(stream(bytes, 137), wavInfo(bytes), 32);
  assert.deepEqual(chunks, whole); assert.ok(average(chunks.bands.mids) > .3);
});
test("PCM and floating point masters produce bounded, finite bands", async () => {
  for (const options of [{ bits: 16 }, { bits: 24 }, { bits: 32 }, { bits: 32, floating: true }]) {
    const bytes = wav(900, options), data = await generateWaveformData(stream(bytes), wavInfo(bytes), 32);
    assert.ok(data.peaks.every(v => v >= 0 && v <= 1));
    assert.ok(average(data.bands.mids) > .3); parseWaveformData(data);
  }
});
test("silent intervals stay silent and a truncated master is rejected", async () => {
  const bytes = wav(0), data = await generateWaveformData(stream(bytes), wavInfo(bytes), 32);
  assert.ok(Object.values(data.bands).flat().every(v => v === 0));
  await assert.rejects(generateWaveformData(stream(bytes.slice(0, -1)), wavInfo(bytes)), /Incomplete WAV/);
});
test("legacy amplitude data stays neutral; malformed band data is rejected", () => {
  assert.deepEqual(parseWaveformData({ version: 1, peaks: [.1, .7] }), { peaks: [.1, .7], bands: null });
  for (const payload of [{ peaks: [NaN] }, { peaks: [-1] }, { peaks: [] }, { version: 2, peaks: [.1], bands: { bass: [.1], mids: [.2], highs: [] } }]) assert.throws(() => parseWaveformData(payload));
});
test("responsive aggregation retains RMS energy and quiet intervals", () => {
  assert.deepEqual(aggregateWaveform([0, 0, 1, 1], 2), [0, 1]);
  assert.equal(aggregateWaveform([0, 1], 1)[0], Math.sqrt(.5));
  assert.deepEqual(aggregateWaveform([.2, .7], 20), [.2, .7]);
});

test("percentage round trips do not lose one second on keyboard seeks", () => {
  assert.equal(timeFromProgress(5 / 3547 * 100, 3547), 5);
  assert.equal(timeFromProgress(-10, 3547), 0);
  assert.equal(timeFromProgress(110, 3547), 3547);
  assert.equal(timeFromProgress(NaN, 3547), 0);
});

test("parallel master reads remain ordered and bounded", async () => {
  const original = globalThis.fetch, bytes = wav(900);
  let active = 0, maximum = 0;
  globalThis.fetch = async (_url, options) => {
    const [, start, end] = /bytes=(\d+)-(\d+)/.exec(options.headers.Range).map(Number);
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, start === 0 ? 8 : 1));
    active--;
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: { "content-range": `bytes ${start}-${end}/${bytes.length}` } });
  };
  try {
    const data = await generateWaveformData(readMasterInRanges("https://master.example/test.wav", bytes.length, undefined, 4097, 3), wavInfo(bytes), 32);
    const expected = await generateWaveformData(stream(bytes), wavInfo(bytes), 32);
    assert.deepEqual(data, expected); assert.ok(maximum <= 3 && maximum > 1);
  } finally { globalThis.fetch = original; }
});

test("a server that ignores byte ranges cannot silently corrupt a scan", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array(44));
  try { await assert.rejects(new Response(readMasterInRanges("https://master.example/test.wav", 44, undefined, 44, 1)).arrayBuffer(), /Invalid master range/); }
  finally { globalThis.fetch = original; }
});
