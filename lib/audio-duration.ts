export async function readStreamPrefix(stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    // For a tee branch, cancellation completes only after the sibling starts
    // reading. Do not block the upload stream while its header is inspected.
    void reader.cancel().catch(() => { /* already closed */ });
  }
  const prefix = new Uint8Array(Math.min(received, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, prefix.length - offset);
    prefix.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= prefix.length) break;
  }
  return prefix;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

// Native FLAC starts with a 34-byte STREAMINFO block (RFC 9639).
export function flacInfo(bytes: Uint8Array) {
  if (bytes.length < 42 || ascii(bytes, 0, 4) !== "fLaC" || (bytes[4] & 0x7f) !== 0) return undefined;
  const length = bytes[5] * 65536 + bytes[6] * 256 + bytes[7];
  if (length !== 34) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minBlock = view.getUint16(8), maxBlock = view.getUint16(10);
  const sampleRate = bytes[18] * 4096 + bytes[19] * 16 + (bytes[20] >> 4);
  const bits = ((bytes[20] & 1) << 4 | bytes[21] >> 4) + 1;
  const totalSamples = (bytes[21] & 0x0f) * 4294967296 + view.getUint32(22);
  if (minBlock < 16 || maxBlock < minBlock || !sampleRate || sampleRate > 655350 || bits < 4) return undefined;
  return { sampleRate, totalSamples };
}

export function durationSecondsFromFlac(bytes: Uint8Array) {
  const info = flacInfo(bytes);
  return info?.totalSamples ? Math.max(1, Math.round(info.totalSamples / info.sampleRate)) : undefined;
}

export function durationSecondsFromAudio(bytes: Uint8Array, fileSize?: number) {
  return durationSecondsFromFlac(bytes) ?? durationSecondsFromWav(bytes, fileSize);
}

export function durationSecondsFromWav(bytes: Uint8Array, fileSize?: number) {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 20 <= bytes.length) byteRate = view.getUint32(offset + 16, true);
    else if (id === "data") {
      dataSize = size;
      break;
    }
    const next = offset + 8 + size + (size % 2);
    if (!Number.isFinite(size) || next <= offset) break;
    offset = next;
  }
  const seconds = dataSize && byteRate ? dataSize / byteRate
    : byteRate && fileSize && fileSize > 44 ? (fileSize - 44) / byteRate
    : 0;
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.max(1, Math.round(seconds));
}
