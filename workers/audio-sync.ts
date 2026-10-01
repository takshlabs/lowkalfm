import { durationSecondsFromWav, readStreamPrefix } from "../lib/audio-duration.ts";
import { handleListenCounts } from "./listen-counts.ts";

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
  YOUTUBE_API_KEY?: string;
  LISTEN_RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
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
  "https://lowkalfm.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173"
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
      const audioFormat = format === 0xfffe && size >= 40 && dataStart + 40 <= bytes.length ? view.getUint16(dataStart + 24, true) : format;
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

async function patchSanityAudio(payload: Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl: string, peaksUrl: string, env: Env, duration?: number, deliveryAssetId?: string) {
  const set: Record<string, string | number> = {
    "audio.deliveryUrl": deliveryUrl,
    "audio.peaksUrl": peaksUrl,
    "audio.sourceAssetId": payload.audioMasterId || "",
    "audio.sourceDeliveryAssetId": deliveryAssetId || "",
    "audio.syncedAt": new Date().toISOString()
  };
  if (duration) set.duration = duration;
  // Read the current master and revision after the upload. An older job must
  // not replace a newer master, even when the two jobs finish out of order.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const queryUrl = new URL(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/query/${env.SANITY_API_DATASET}`);
    queryUrl.searchParams.set("query", '*[_id == $id][0]{_rev,"master":audio.master.asset._ref,"delivery":audio.delivery.asset._ref}');
    queryUrl.searchParams.set("$id", JSON.stringify(payload._id));
    const currentResponse = await fetch(queryUrl, { headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}` } });
    if (!currentResponse.ok) throw new Error(`Sanity source check failed: ${currentResponse.status}`);
    const current = ((await currentResponse.json()) as { result: { _rev: string; master: string; delivery?: string } | null }).result;
    if (!current || current.master !== payload.audioMasterId || (current.delivery || "") !== (deliveryAssetId || "")) return false;
    const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [{ patch: { id: payload._id, ifRevisionID: current._rev, set } }] })
    });
    if (response.ok) return true;
    if (response.status !== 409) throw new Error(`Sanity patch failed with ${response.status}`);
  }
  throw new Error("Sanity source changed during audio update");
}

async function syncAudio(request: Request, env: Env, authorize: (rawBody: string) => Promise<boolean> | boolean) {
  const rawBody = await request.text();
  if (!await authorize(rawBody)) return new Response("Unauthorized", { status: 401 });
  let payload: AudioSyncPayload;
  try { payload = JSON.parse(rawBody) as AudioSyncPayload; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (payload._type !== "mix" || !payload._id || !payload.audioMasterUrl) return new Response(null, { status: 204 });
  const audioMasterId = payload.audioMasterId || sourceAssetId(payload.audioMasterUrl);
  if (!audioMasterId) return new Response(null, { status: 204 });
  const queryUrl = new URL(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/query/${env.SANITY_API_DATASET}`);
  queryUrl.searchParams.set("query", '*[_id == $id][0]{"master":audio.master.asset._ref,"deliveryId":audio.delivery.asset._ref,"deliveryUrl":audio.delivery.asset->url,"sourceId":audio.sourceAssetId,"sourceDeliveryId":audio.sourceDeliveryAssetId,"waveformId":audio.waveform.asset._ref,"waveformUrl":audio.waveform.asset->url,"peaksUrl":audio.peaksUrl}');
  queryUrl.searchParams.set("$id", JSON.stringify(payload._id));
  const currentResponse = await fetch(queryUrl, { headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}` } });
  if (!currentResponse.ok) return new Response("Could not check the current master", { status: 502 });
  const current = ((await currentResponse.json()) as { result: { master: string; deliveryId?: string; deliveryUrl?: string; sourceId?: string; sourceDeliveryId?: string; waveformId?: string; waveformUrl?: string; peaksUrl?: string } | null }).result;
  if (!current || current.master !== audioMasterId) return new Response(null, { status: 204 });
  if (current.sourceId === audioMasterId && current.sourceDeliveryId === current.deliveryId) return new Response(null, { status: 204 });
  if (!current.deliveryUrl || !current.deliveryId?.endsWith("-mp3")) return new Response("Prepare an MP3 delivery file before publication", { status: 422 });
  const waveformUrl = current.waveformUrl || (current.sourceId === audioMasterId ? current.peaksUrl : undefined);
  if (!waveformUrl) return new Response("Prepare waveform data for this master before publication", { status: 422 });
  // Decode the archive master outside the Worker. Only small prepared metadata
  // and the streamed MP3 enter this Free-plan Worker.
  const waveformResponse = await fetch(waveformUrl);
  if (!waveformResponse.ok) return new Response("Could not read waveform data", { status: 502 });
  const waveform = await waveformResponse.json() as { version?: number; sourceAssetId?: string; peaks?: number[] };
  if (waveform.version !== 1 || !Array.isArray(waveform.peaks) || waveform.peaks.length !== peakCount || !waveform.peaks.every((peak) => Number.isFinite(peak) && peak >= 0 && peak <= 1) || (current.waveformUrl && waveform.sourceAssetId !== audioMasterId)) return new Response("Invalid waveform data for this master", { status: 422 });
  const headerResponse = await fetch(payload.audioMasterUrl, { headers: { Range: "bytes=0-131071" } });
  if (!headerResponse.ok || !headerResponse.body) return new Response("Could not read WAV header", { status: 502 });
  const headerBytes = await readStreamPrefix(headerResponse.body, 131072);
  const info = wavInfo(headerBytes);
  if (!info || !((info.audioFormat === 1 && [16, 24, 32].includes(info.bits)) || (info.audioFormat === 3 && info.bits === 32))) return new Response("Use a PCM WAV or 32-bit float WAV master", { status: 422 });
  const sourceSize = Number(headerResponse.headers.get("content-range")?.split("/")[1]) || Number(headerResponse.headers.get("content-length")) || undefined;
  const duration = durationSecondsFromWav(headerBytes, sourceSize);
  const source = await fetch(current.deliveryUrl);
  if (!source.ok || !source.body) return new Response("Could not download the MP3 delivery file", { status: 502 });
  const objectKey = `mixes/${safeSegment(payload._id)}/${safeSegment(audioMasterId)}-${safeSegment(current.deliveryId)}.mp3`;
  await env.AUDIO.put(objectKey, source.body, { httpMetadata: { contentType: "audio/mpeg", cacheControl: "public, max-age=31536000, immutable" } });
  const peaksKey = `${objectKey}-${safeSegment(current.waveformId || "legacy")}.peaks.json`;
  await env.AUDIO.put(peaksKey, JSON.stringify({ version: 1, peaks: waveform.peaks }), { httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=31536000, immutable" } });
  const configuredBase = env.AUDIO_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const audioBase = configuredBase.endsWith("/audio") ? configuredBase : `${configuredBase}/audio`;
  const publicUrl = (key: string) => `${audioBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const deliveryUrl = publicUrl(objectKey);
  const peaksUrl = publicUrl(peaksKey);
  const patched = await patchSanityAudio({ ...payload, _id: payload._id, audioMasterId }, deliveryUrl, peaksUrl, env, duration, current.deliveryId);
  return Response.json({ deliveryUrl, peaksUrl, published: patched });
}

const worker = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/listen-counts") {
      try { return await handleListenCounts(request, env); } catch (error) { console.error(error); return new Response("Count unavailable", { status: 503 }); }
    }
    if (url.pathname.startsWith("/audio/") && (request.method === "GET" || request.method === "HEAD")) return serveAudio(request, env);
    if (url.pathname !== "/sanity/audio-sync" || request.method !== "POST") return new Response("Not found", { status: 404 });
    try { return await syncAudio(request, env, (rawBody) => validSanitySignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)); } catch (error) { console.error(error); return new Response("Audio sync failed", { status: 500 }); }
  }
};

export default worker;
