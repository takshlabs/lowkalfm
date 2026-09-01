import { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, handleImageOptimization } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface AssetFetcher { fetch(input: Request): Promise<Response>; }
interface AudioObject {
  body: ReadableStream<Uint8Array>;
  size: number;
  etag: string;
  range?: { offset: number; length: number };
  httpMetadata?: { contentType?: string };
}
interface AudioBucket {
  get(key: string, options?: { range?: Headers }): Promise<AudioObject | null>;
  put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
}
interface Env {
  ASSETS: AssetFetcher;
  AUDIO?: AudioBucket;
  SANITY_WEBHOOK_SECRET?: string;
  SANITY_API_PROJECT_ID?: string;
  SANITY_API_DATASET?: string;
  SANITY_API_WRITE_TOKEN?: string;
  IMAGES: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }>; }; }; };
}
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; }

const encoder = new TextEncoder();

function base64Url(bytes: ArrayBuffer) {
  const value = new Uint8Array(bytes);
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function hasValidSanitySignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!secret || !signature) return false;
  const timestamp = /^t=(\d+),v1=([A-Za-z0-9_-]+)$/.exec(signature);
  if (!timestamp) return false;
  const signedAt = Number(timestamp[1]);
  if (!Number.isFinite(signedAt) || Math.abs(Date.now() - signedAt * 1000) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp[1]}.${rawBody}`));
  return constantTimeEqual(base64Url(digest), timestamp[2]);
}

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 160) || "audio";
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
  const relative = pathname.slice("/audio/".length).split("/");
  if (!relative.length || relative.some((part) => !part || part === "." || part === "..")) return null;
  try { return relative.map((part) => decodeURIComponent(part)).join("/"); } catch { return null; }
}

async function serveAudio(request: Request, bucket: AudioBucket) {
  const key = audioKeyFromRequest(new URL(request.url).pathname);
  if (!key) return new Response("Not found", { status: 404 });
  const range = request.headers.get("range") ? request.headers : undefined;
  const object = await bucket.get(key, range ? { range } : undefined);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(object.range?.length ?? object.size),
    "Content-Type": object.httpMetadata?.contentType || "audio/wav",
    ETag: object.etag
  });
  if (object.range) headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  return new Response(request.method === "HEAD" ? null : object.body, { status: object.range ? 206 : 200, headers });
}

type AudioSyncPayload = { _id?: string; _type?: string; audioMasterUrl?: string; audioMasterFilename?: string; audioMasterId?: string; audioSourceAssetId?: string };

async function patchSanityAudio(payload: Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl: string, env: Env) {
  const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations: [{ patch: { id: payload._id, set: { "audio.deliveryUrl": deliveryUrl, "audio.sourceAssetId": payload.audioMasterId || "", "audio.syncedAt": new Date().toISOString() } } }] })
  });
  if (!response.ok) throw new Error(`Sanity patch failed with ${response.status}`);
}

async function syncAudioFromSanity(request: Request, env: Env) {
  const rawBody = await request.text();
  if (!await hasValidSanitySignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });
  if (!env.AUDIO || !env.SANITY_API_PROJECT_ID || !env.SANITY_API_DATASET || !env.SANITY_API_WRITE_TOKEN) return new Response("Audio sync is not configured", { status: 503 });
  let payload: AudioSyncPayload;
  try { payload = JSON.parse(rawBody) as AudioSyncPayload; } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (payload._type !== "mix" || !payload._id || !payload.audioMasterUrl || !payload.audioMasterId || payload.audioSourceAssetId === payload.audioMasterId) return new Response(null, { status: 204 });

  const source = await fetch(payload.audioMasterUrl);
  if (!source.ok || !source.body) return new Response("Could not download the audio master", { status: 502 });
  const filename = safeSegment(payload.audioMasterFilename || `${payload.audioMasterId}.wav`);
  const objectKey = `mixes/${safeSegment(payload._id)}/${safeSegment(payload.audioMasterId)}-${filename}`;
  await env.AUDIO.put(objectKey, source.body, { httpMetadata: { contentType: audioContentType(source, filename), cacheControl: "public, max-age=31536000, immutable" } });
  const origin = new URL(request.url).origin;
  const deliveryUrl = `${origin}/audio/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  await patchSanityAudio(payload as Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl, env);
  return Response.json({ deliveryUrl });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/audio/") && env.AUDIO && (request.method === "GET" || request.method === "HEAD")) return serveAudio(request, env.AUDIO);
    if (url.pathname === "/api/sanity/audio-sync" && request.method === "POST") return syncAudioFromSanity(request, env);
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => (await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality })).response()
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  }
};

export default worker;
