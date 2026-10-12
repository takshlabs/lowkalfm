export type WavInfo = { audioFormat: number; channels: number; sampleRate: number; blockAlign: number; bits: number; dataOffset: number; dataSize: number };
export type WaveformData = { version: 2; duration: number; peaks: number[]; bands: { bass: number[]; mids: number[]; highs: number[] }; crossovers: [number, number, number]; sampleRate: number };

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function wavInfo(bytes: Uint8Array): WavInfo | undefined {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: Omit<WavInfo, "dataOffset" | "dataSize"> | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = ascii(bytes, offset, 4), size = view.getUint32(offset + 4, true), start = offset + 8;
    if (id === "fmt " && size >= 16 && start + 16 <= bytes.length) {
      const tag = view.getUint16(start, true);
      format = { audioFormat: tag === 0xfffe && size >= 40 && start + 40 <= bytes.length ? view.getUint16(start + 24, true) : tag, channels: view.getUint16(start + 2, true), sampleRate: view.getUint32(start + 4, true), blockAlign: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true) };
    } else if (id === "data" && format) return { ...format, dataOffset: start, dataSize: size };
    offset = start + size + size % 2;
  }
  return undefined;
}

function sample(view: DataView, offset: number, info: WavInfo) {
  if (info.audioFormat === 3) return view.getFloat32(offset, true);
  if (info.bits === 16) return view.getInt16(offset, true) / 32768;
  if (info.bits === 32) return view.getInt32(offset, true) / 2147483648;
  const raw = view.getUint8(offset) | view.getUint8(offset + 1) << 8 | view.getUint8(offset + 2) << 16;
  return (raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608;
}

// Scan the master once. First-order complementary crossovers separate the
// signal at 250 and 2,000 Hz; a 20 Hz high-pass removes DC. Keep each channel
// separate until energy aggregation so opposite stereo phases do not cancel.
export async function generateWaveformData(stream: ReadableStream<Uint8Array>, info: WavInfo, requestedCount = 2048): Promise<WaveformData> {
  const bytesPerSample = info.bits / 8;
  if (!info.channels || info.channels > 32 || info.sampleRate < 8000 || info.sampleRate > 384000 || !info.dataSize || info.dataSize % info.blockAlign || info.blockAlign !== info.channels * bytesPerSample) throw new Error("Invalid WAV data");
  if (!((info.audioFormat === 1 && [16, 24, 32].includes(info.bits)) || (info.audioFormat === 3 && info.bits === 32))) throw new Error("Unsupported WAV format");
  if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 16384) throw new Error("Invalid waveform resolution");
  const frames = info.dataSize / info.blockAlign, count = Math.min(requestedCount, frames);
  const peaks = new Float64Array(count), energy = [new Float64Array(count), new Float64Array(count), new Float64Array(count)], samples = new Uint32Array(count);
  const filters = Array.from({ length: info.channels }, () => [0, 0, 0]);
  const coefficients = [20, 250, 2000].map(hz => 1 - Math.exp(-2 * Math.PI * hz / info.sampleRate));
  const reader = stream.getReader();
  let offset = 0, frame = 0, remaining = new Uint8Array();
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      const start = Math.max(0, info.dataOffset - offset), end = Math.min(value.length, info.dataOffset + info.dataSize - offset);
      if (end > start) {
        const bytes = new Uint8Array(remaining.length + end - start);
        bytes.set(remaining); bytes.set(value.subarray(start, end), remaining.length);
        const view = new DataView(bytes.buffer);
        let position = 0;
        for (; position + info.blockAlign <= bytes.length; position += info.blockAlign, frame++) {
          const index = Math.min(count - 1, Math.floor(frame * count / frames));
          for (let channel = 0; channel < info.channels; channel++) {
            const raw = sample(view, position + channel * bytesPerSample, info);
            const input = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
            peaks[index] = Math.max(peaks[index], Math.abs(input));
            const f = filters[channel];
            f[0] += coefficients[0] * (input - f[0]);
            const ac = input - f[0];
            f[1] += coefficients[1] * (ac - f[1]);
            f[2] += coefficients[2] * (ac - f[2]);
            const bass = f[1], mids = f[2] - f[1], highs = ac - f[2];
            energy[0][index] += bass * bass; energy[1][index] += mids * mids; energy[2][index] += highs * highs;
          }
          samples[index] += info.channels;
        }
        remaining = bytes.slice(position);
      }
      offset += value.length;
    }
  } finally { if (!complete) await reader.cancel().catch(() => {}); }
  if (remaining.length || frame !== frames) throw new Error("Incomplete WAV data");
  const round = (value: number) => Math.round(Math.min(1, value) * 10000) / 10000;
  const bands = energy.map(values => Array.from(values, (value, i) => round(Math.sqrt(value / Math.max(1, samples[i])))));
  return { version: 2, duration: frames / info.sampleRate, sampleRate: info.sampleRate, crossovers: [20, 250, 2000], peaks: Array.from(peaks, round), bands: { bass: bands[0], mids: bands[1], highs: bands[2] } };
}
