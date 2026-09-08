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
    try { await reader.cancel(); } catch { /* already closed */ }
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
