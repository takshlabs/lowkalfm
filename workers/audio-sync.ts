interface AudioObject {
  body: ReadableStream<Uint8Array>;
  size: number;
  etag: string;
  range?: { offset: number; length: number };
  httpMetadata?: { contentType?: string };
}

interface AudioObjectBucket {
  get(key: string, options?: { range?: Headers }): Promise<AudioObject | null>;
  put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
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

async function serveAudio(request: Request, env: Env) {
  const objectKey = audioKeyFromRequest(new URL(request.url).pathname);
  if (!objectKey) return new Response("Not found", { status: 404 });
  const object = await env.AUDIO.get(objectKey, request.headers.get("range") ? { range: request.headers } : undefined);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "https://lowkalfm.vercel.app",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": String(object.range?.length ?? object.size),
    "Content-Type": object.httpMetadata?.contentType || "audio/wav",
    ETag: object.etag
  });
  if (object.range) headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  return new Response(request.method === "HEAD" ? null : object.body, { status: object.range ? 206 : 200, headers });
}

async function patchSanityAudio(payload: Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl: string, env: Env) {
  const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations: [{ patch: { id: payload._id, set: { "audio.deliveryUrl": deliveryUrl, "audio.sourceAssetId": payload.audioMasterId || "", "audio.syncedAt": new Date().toISOString() } } }] })
  });
  if (!response.ok) throw new Error(`Sanity patch failed with ${response.status}`);
}

async function syncAudio(request: Request, env: Env) {
  const rawBody = await request.text();
  if (!await validSanitySignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });
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
  await env.AUDIO.put(objectKey, source.body, { httpMetadata: { contentType: audioContentType(source, filename), cacheControl: "public, max-age=31536000, immutable" } });
  const configuredBase = env.AUDIO_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const audioBase = configuredBase.endsWith("/audio") ? configuredBase : `${configuredBase}/audio`;
  const deliveryUrl = `${audioBase}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  await patchSanityAudio(syncPayload as Required<Pick<AudioSyncPayload, "_id">> & AudioSyncPayload, deliveryUrl, env);
  return Response.json({ deliveryUrl });
}

const worker = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/audio/") && (request.method === "GET" || request.method === "HEAD")) return serveAudio(request, env);
    if (url.pathname !== "/sanity/audio-sync" || request.method !== "POST") return new Response("Not found", { status: 404 });
    try { return await syncAudio(request, env); } catch (error) { console.error(error); return new Response("Audio sync failed", { status: 500 }); }
  }
};

export default worker;
