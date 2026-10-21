import { durationSecondsFromAudio, flacInfo, readStreamPrefix } from "../lib/audio-duration.ts";
import { generateWaveformData, wavInfo } from "../lib/waveform-data.ts";
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

export interface Env {
  AUDIO: AudioObjectBucket;
  SANITY_WEBHOOK_SECRET: string;
  SANITY_API_PROJECT_ID: string;
  SANITY_API_DATASET: string;
  SANITY_API_WRITE_TOKEN: string;
  AUDIO_PUBLIC_BASE_URL: string;
  YOUTUBE_API_KEY?: string;
  LISTEN_RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
  AUDIO_SYNC: {
    create(options: { id: string; params: AudioSyncPayload }): Promise<{ id: string }>;
    get(id: string): Promise<{ status(): Promise<{ status: string }>; restart(): Promise<void> }>;
  };
}

export type AudioSyncPayload = {
  _id?: string;
  _type?: string;
  audioMasterUrl?: string;
  audioMasterFilename?: string;
  audioMasterId?: string;
  audioSourceAssetId?: string;
};

const encoder = new TextEncoder();
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
  // Sanity signs with a Unix timestamp in milliseconds (see @sanity/webhook).
  if (!Number.isFinite(signedAt) || signedAt < 1609459200000 || Math.abs(Date.now() - signedAt) > 5 * 60 * 1000) return false;
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

async function patchSanityAudio(payload: Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl: string, peaksUrl: string | undefined, env: Env, duration?: number) {
  const set: Record<string, string | number> = {
    "audio.deliveryUrl": deliveryUrl,
    "audio.sourceAssetId": payload.audioMasterId || "",
    "audio.syncedAt": new Date().toISOString()
  };
  if (peaksUrl) set["audio.peaksUrl"] = peaksUrl;
  if (duration) set.duration = duration;
  // Read the current master and revision after the upload. An older job must
  // not replace a newer master, even when the two jobs finish out of order.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const queryUrl = new URL(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/query/${env.SANITY_API_DATASET}`);
    queryUrl.searchParams.set("query", '*[_id == $id][0]{_rev,"master":audio.master.asset._ref}');
    queryUrl.searchParams.set("$id", JSON.stringify(payload._id));
    const currentResponse = await fetch(queryUrl, { headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}` } });
    if (!currentResponse.ok) throw new Error(`Sanity source check failed: ${currentResponse.status}`);
    const current = ((await currentResponse.json()) as { result: { _rev: string; master: string } | null }).result;
    if (!current || current.master !== payload.audioMasterId) return false;
    const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [{ patch: { id: payload._id, ifRevisionID: current._rev, set, ...(!peaksUrl ? { unset: ["audio.peaksUrl"] } : {}) } }] })
    });
    if (response.ok) return true;
    if (response.status !== 409) throw new Error(`Sanity patch failed with ${response.status}`);
  }
  throw new Error("Sanity source changed during audio update");
}

async function hasSavedWaveform(env: Env, key: string, duration: number, sampleRate: number, count: number) {
  const object = await env.AUDIO.get(key);
  if (!object) return false;
  if (object.size > 1024 * 1024) { void object.body.cancel().catch(() => {}); return false; }
  try {
    const data = await new Response(object.body).json() as {
      version?: number; duration?: number; sampleRate?: number; peaks?: unknown;
      bands?: { bass?: unknown; mids?: unknown; highs?: unknown };
    } | null;
    const validBand = (values: unknown) => Array.isArray(values) && values.length === count && values.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1);
    return data?.version === 2 && data.sampleRate === sampleRate && typeof data.duration === "number"
      && Math.abs(data.duration - duration) <= 1 / sampleRate
      && [data.peaks, data.bands?.bass, data.bands?.mids, data.bands?.highs].every(validBand);
  } catch { return false; }
}

async function queueAudioMaster(payload: AudioSyncPayload, env: Env) {
  // One job per mix and master. Publish retries must not start duplicate copies.
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify([payload._id, payload.audioMasterId])));
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  try {
    await env.AUDIO_SYNC.create({ id, params: payload });
  } catch (error) {
    // A duplicate create fails. Confirm that the saved job exists before we
    // acknowledge the publish, and restart a failed job on a new publish.
    const instance = await env.AUDIO_SYNC.get(id);
    const { status } = await instance.status();
    if (status === "errored" || status === "terminated") await instance.restart();
    else if (!["queued", "running", "waiting", "complete"].includes(status)) throw error;
  }
  return Response.json({ jobId: id }, { status: 202 });
}

export async function syncAudioRequest(request: Request, env: Env, processMaster = queueAudioMaster) {
  const rawBody = await request.text();
  if (!await validSanitySignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });
  let payload: AudioSyncPayload;
  try { payload = JSON.parse(rawBody) as AudioSyncPayload; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (payload._type !== "mix" || !payload._id || !payload.audioMasterUrl) return new Response(null, { status: 204 });
  const audioMasterId = payload.audioMasterId || sourceAssetId(payload.audioMasterUrl);
  if (!audioMasterId || payload.audioSourceAssetId === audioMasterId) return new Response(null, { status: 204 });
  const syncPayload = { ...payload, audioMasterId };
  return processMaster(syncPayload, env);
}

export async function copyAudioMaster(payload: AudioSyncPayload, env: Env) {
  if (!payload._id || !payload.audioMasterUrl) throw new Error("Audio master is missing");
  const audioMasterId = payload.audioMasterId || sourceAssetId(payload.audioMasterUrl);
  const syncPayload = { ...payload, audioMasterId };
  const source = await fetch(payload.audioMasterUrl);
  if (!source.ok || !source.body) return new Response("Could not download audio master", { status: 502 });
  const [headerStream, audioStream] = source.body.tee();
  const headerBytes = await readStreamPrefix(headerStream, 131072);
  const info = wavInfo(headerBytes);
  const flac = flacInfo(headerBytes);
  if (!info && !flac) { void audioStream.cancel().catch(() => {}); return new Response("Use a FLAC, PCM WAV, or 32-bit float WAV master", { status: 422 }); }
  const extension = flac ? "flac" : "wav";
  const filename = safeSegment(payload.audioMasterFilename || `${audioMasterId}.${extension}`);
  const objectKey = `mixes/${safeSegment(payload._id)}/${safeSegment(audioMasterId)}-${filename}`;
  const fileSize = Number(source.headers.get("content-length")) || undefined;
  const duration = durationSecondsFromAudio(headerBytes, fileSize);
  const configuredBase = env.AUDIO_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const audioBase = configuredBase.endsWith("/audio") ? configuredBase : `${configuredBase}/audio`;
  const deliveryUrl = `${audioBase}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  if (flac) {
    await env.AUDIO.put(objectKey, audioStream, { httpMetadata: { contentType: "audio/flac", cacheControl: "public, max-age=31536000, immutable" } });
    const patched = await patchSanityAudio(syncPayload as Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl, undefined, env, duration);
    return Response.json({ deliveryUrl, published: patched });
  }
  const peaksKey = `${objectKey}.spectrum-v2.json`;
  const frames = info!.dataSize / info!.blockAlign;
  if (await hasSavedWaveform(env, peaksKey, frames / info!.sampleRate, info!.sampleRate, Math.min(2048, frames))) {
    // The key contains the master asset ID. A locally measured waveform can
    // complete a copy that exceeded the Worker's CPU limit.
    await env.AUDIO.put(objectKey, audioStream, { httpMetadata: { contentType: "audio/wav", cacheControl: "public, max-age=31536000, immutable" } });
  } else {
    const [audioObjectStream, peakStream] = audioStream.tee();
    const audioWrite = env.AUDIO.put(objectKey, audioObjectStream, { httpMetadata: { contentType: "audio/wav", cacheControl: "public, max-age=31536000, immutable" } });
    const [waveform] = await Promise.all([generateWaveformData(peakStream, info!), audioWrite]);
    await env.AUDIO.put(peaksKey, JSON.stringify(waveform), { httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=31536000, immutable" } });
  }
  const peaksUrl = `${audioBase}/${peaksKey.split("/").map(encodeURIComponent).join("/")}`;
  const patched = await patchSanityAudio(syncPayload as Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl, peaksUrl, env, duration);
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
    try { return await syncAudioRequest(request, env); } catch (error) { console.error(error); return new Response("Audio sync failed", { status: 500 }); }
  }
};

export default worker;
