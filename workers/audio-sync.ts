import { durationSecondsFromWav, readStreamPrefix } from "../lib/audio-duration.ts";

interface AudioObject {
  body: ReadableStream<Uint8Array>;
  size: number;
  etag: string;
  range?: { offset: number; length: number };
  httpMetadata?: { contentType?: string };
}

interface AudioObjectBucket {
  get(key: string, options?: { range?: Headers }): Promise<AudioObject | null>;
  put(key: string, value: ReadableStream<Uint8Array> | string, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
}

interface Env {
  AUDIO: AudioObjectBucket;
  SANITY_WEBHOOK_SECRET: string;
  SANITY_API_PROJECT_ID: string;
  SANITY_API_DATASET: string;
  SANITY_API_WRITE_TOKEN: string;
  AUDIO_PUBLIC_BASE_URL: string;
}

type AudioSyncPayload = {
  _id?: string;
  _type?: string;
  audioMasterUrl?: string;
  audioMasterFilename?: string;
  audioMasterId?: string;
  audioSourceAssetId?: string;
};

const encoder = new TextEncoder();
const peakCount = 128;
const AUDIO_ORIGINS = new Set([
  "https://lowkalfm.in",
  "https://www.lowkalfm.in",
  "https://lowkalfm.vercel.app"
]);

function audioCorsOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin && AUDIO_ORIGINS.has(origin) ? origin : "https://lowkalfm.in";
}

function base64Url(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function validSanitySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const match = /^t=(\d+),v1=([A-Za-z0-9_-]+)$/.exec(signature);
  if (!match) return false;
  const signedAt = Number(match[1]);
  if (!Number.isFinite(signedAt) || Math.abs(Date.now() - signedAt * 1000) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${match[1]}.${rawBody}`));
  return constantTimeEqual(base64Url(digest), match[2]);
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 160) || "audio";
}

function sourceAssetId(sourceUrl: string) {
  try {
    const filename = new URL(sourceUrl).pathname.split("/").pop() || "";
    const match = /^([a-f0-9]+)\.([A-Za-z0-9]+)$/i.exec(filename);
    return match ? `file-${match[1]}-${match[2].toLowerCase()}` : "";
  } catch { return ""; }
}

function audioContentType(source: Response, filename: string) {
  const contentType = source.headers.get("content-type")?.split(";")[0];
  if (contentType?.startsWith("audio/")) return contentType;
  if (/\.flac$/i.test(filename)) return "audio/flac";
  if (/\.(m4a|mp4)$/i.test(filename)) return "audio/mp4";
  if (/\.aac$/i.test(filename)) return "audio/aac";
  if (/\.mp3$/i.test(filename)) return "audio/mpeg";
  return "audio/wav";
}

function audioKeyFromRequest(pathname: string) {
  const parts = pathname.slice("/audio/".length).split("/");
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) return null;
  try { return parts.map(decodeURIComponent).join("/"); } catch { return null; }
}

type WavInfo = {
  audioFormat: number;
  channels: number;
  blockAlign: number;
  bits: number;
  dataOffset: number;
  dataSize: number;
};

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function wavInfo(bytes: Uint8Array): WavInfo | undefined {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    if (id === "fmt " && size >= 16 && dataStart + 16 <= bytes.length) {
      const format = view.getUint16(dataStart, true);
      const audioFormat = format === 0xfffe && size >= 40 ? view.getUint16(dataStart + 24, true) : format;
      const channels = view.getUint16(dataStart + 2, true);
      const blockAlign = view.getUint16(dataStart + 12, true);
      const bits = view.getUint16(dataStart + 14, true);
      let next = dataStart + size + (size % 2);
      while (next + 8 <= bytes.length) {
        const nextId = ascii(bytes, next, 4);
        const nextSize = view.getUint32(next + 4, true);
        if (nextId === "data") return { audioFormat, channels, blockAlign, bits, dataOffset: next + 8, dataSize: nextSize };
        next += 8 + nextSize + (nextSize % 2);
      }
      return undefined;
    }
    offset += 8 + size + (size % 2);
  }
  return undefined;
}

function sampleAmplitude(view: DataView, offset: number, info: WavInfo) {
  if (info.audioFormat === 3 && info.bits === 32) return Math.abs(view.getFloat32(offset, true));
  if (info.audioFormat !== 1) return 0;
  if (info.bits === 16) return Math.abs(view.getInt16(offset, true) / 32768);
  if (info.bits === 24) {
    const raw = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
    return Math.abs((raw & 0x800000 ? raw - 0x1000000 : raw) / 8388608);
  }
  if (info.bits === 32) return Math.abs(view.getInt32(offset, true) / 2147483648);
  return 0;
}

function waveformPeak(frame: Uint8Array, info: WavInfo) {
  const bytesPerSample = info.bits / 8;
  if (!Number.isInteger(bytesPerSample) || info.blockAlign !== info.channels * bytesPerSample) return undefined;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  let maximum = 0;
  for (let channel = 0; channel < info.channels; channel += 1) maximum = Math.max(maximum, sampleAmplitude(view, channel * bytesPerSample, info));
  return Number.isFinite(maximum) ? Math.min(1, maximum) : 0;
}

async function waveformPeaks(stream: ReadableStream<Uint8Array>, info: WavInfo) {
  if (!info.channels || !info.blockAlign || !info.dataSize) throw new Error("Invalid WAV data");
  const peaks = Array.from({ length: peakCount }, () => 0);
  const reader = stream.getReader();
  let offset = 0;
  let remaining = new Uint8Array();
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      const dataStart = Math.max(0, info.dataOffset - offset);
      const dataEnd = Math.min(value.byteLength, info.dataOffset + info.dataSize - offset);
      if (dataEnd > dataStart) {
        const next = new Uint8Array(remaining.byteLength + dataEnd - dataStart);
        next.set(remaining);
        next.set(value.subarray(dataStart, dataEnd), remaining.byteLength);
        let frameOffset = 0;
        while (frameOffset + info.blockAlign <= next.byteLength) {
          const framePosition = offset + dataStart - info.dataOffset + frameOffset - remaining.byteLength;
          const peak = waveformPeak(next.subarray(frameOffset, frameOffset + info.blockAlign), info);
          if (peak === undefined) throw new Error("Unsupported WAV format");
          const index = Math.min(peakCount - 1, Math.floor(framePosition * peakCount / info.dataSize));
          peaks[index] = Math.max(peaks[index], peak);
          frameOffset += info.blockAlign;
        }
        remaining = next.slice(frameOffset);
      }
      offset += value.byteLength;
    }
  } finally {
    if (!complete) {
      try { await reader.cancel(); } catch { /* already closed */ }
    }
  }
  if (remaining.byteLength) throw new Error("Incomplete WAV frame");
  return peaks.map((peak) => Math.round(peak * 10000) / 10000);
}

async function serveAudio(request: Request, env: Env) {
  const objectKey = audioKeyFromRequest(new URL(request.url).pathname);
  if (!objectKey) return new Response("Not found", { status: 404 });
  const object = await env.AUDIO.get(objectKey, request.headers.get("range") ? { range: request.headers } : undefined);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": audioCorsOrigin(request),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(object.range?.length ?? object.size),
    "Content-Type": object.httpMetadata?.contentType || "audio/wav",
    ETag: object.etag
  });
  headers.append("Vary", "Origin");
  if (object.range) headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  return new Response(request.method === "HEAD" ? null : object.body, { status: object.range ? 206 : 200, headers });
}

async function patchSanityAudio(payload: Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl: string, peaksUrl: string, env: Env, duration?: number) {
  const set: Record<string, string | number> = {
    "audio.deliveryUrl": deliveryUrl,
    "audio.peaksUrl": peaksUrl,
    "audio.sourceAssetId": payload.audioMasterId || "",
    "audio.syncedAt": new Date().toISOString()
  };
  if (duration) set.duration = duration;
  const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations: [{ patch: { id: payload._id, set } }] })
  });
  if (!response.ok) throw new Error(`Sanity patch failed with ${response.status}`);
}

async function syncAudio(request: Request, env: Env, authorize: (rawBody: string) => Promise<boolean> | boolean) {
  const rawBody = await request.text();
  if (!await authorize(rawBody)) return new Response("Unauthorized", { status: 401 });
  let payload: AudioSyncPayload;
  try { payload = JSON.parse(rawBody) as AudioSyncPayload; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (payload._type !== "mix" || !payload._id || !payload.audioMasterUrl) return new Response(null, { status: 204 });
  const audioMasterId = payload.audioMasterId || sourceAssetId(payload.audioMasterUrl);
  if (!audioMasterId || payload.audioSourceAssetId === audioMasterId) return new Response(null, { status: 204 });
  const syncPayload = { ...payload, audioMasterId };

  const source = await fetch(payload.audioMasterUrl);
  if (!source.ok || !source.body) return new Response("Could not download audio master", { status: 502 });
  const filename = safeSegment(payload.audioMasterFilename || `${audioMasterId}.wav`);
  const objectKey = `mixes/${safeSegment(payload._id)}/${safeSegment(audioMasterId)}-${filename}`;
  const [headerStream, audioStream] = source.body.tee();
  const headerBytes = await readStreamPrefix(headerStream, 131072);
  const info = wavInfo(headerBytes);
  if (!info) return new Response("Could not read WAV waveform data", { status: 422 });
  const fileSize = Number(source.headers.get("content-length")) || undefined;
  const duration = durationSecondsFromWav(headerBytes, fileSize);
  const [audioObjectStream, peakStream] = audioStream.tee();
  const audioWrite = env.AUDIO.put(objectKey, audioObjectStream, { httpMetadata: { contentType: audioContentType(source, filename), cacheControl: "public, max-age=31536000, immutable" } });
  const configuredBase = env.AUDIO_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const audioBase = configuredBase.endsWith("/audio") ? configuredBase : `${configuredBase}/audio`;
  const deliveryUrl = `${audioBase}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  const [peaks] = await Promise.all([waveformPeaks(peakStream, info), audioWrite]);
  const peaksKey = `${objectKey}.peaks.json`;
  await env.AUDIO.put(peaksKey, JSON.stringify({ version: 1, peaks }), { httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=31536000, immutable" } });
  const peaksUrl = `${audioBase}/${peaksKey.split("/").map(encodeURIComponent).join("/")}`;
  await patchSanityAudio(syncPayload as Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl, peaksUrl, env, duration);
  return Response.json({ deliveryUrl, peaksUrl });
}

const worker = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/audio/") && (request.method === "GET" || request.method === "HEAD")) return serveAudio(request, env);
    if (url.pathname !== "/sanity/audio-sync" || request.method !== "POST") return new Response("Not found", { status: 404 });
    try { return await syncAudio(request, env, (rawBody) => validSanitySignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)); } catch (error) { console.error(error); return new Response("Audio sync failed", { status: 500 }); }
  }
};

export default worker;
