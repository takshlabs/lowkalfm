import { durationSecondsFromAudio, flacInfo } from "../lib/audio-duration.ts";
import { wavInfo } from "../lib/waveform-data.ts";
import type { Env } from "./audio-sync.ts";

export const AUDIO_PART_BYTES = 8 * 1024 * 1024;
const origins = new Set(["https://lowkalfm.in", "http://localhost:3000", "http://localhost:5173"]);
type Part = { partNumber: number; etag: string };
export interface MultipartBucket {
  createMultipartUpload(key: string, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<{ uploadId: string }>;
  resumeMultipartUpload(key: string, uploadId: string): {
    uploadPart(number: number, body: ArrayBuffer): Promise<Part>;
    complete(parts: Part[]): Promise<unknown>;
    abort(): Promise<void>;
  };
}
type Ticket = { key: string; id: string; uploadId: string; filename: string; size: number; expires: number };
const encode = (value: string) => new TextEncoder().encode(value);
const base64 = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(ticket: Ticket, secret: string) {
  const data = base64(encode(JSON.stringify(ticket)));
  return `${data}.${base64(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encode(data))))}`;
}
async function verify(value: string, secret: string): Promise<Ticket | null> {
  try {
    const [data, signature] = value.split(".");
    if (!await crypto.subtle.verify("HMAC", await signingKey(secret), decode(signature), encode(data))) return null;
    const ticket = JSON.parse(new TextDecoder().decode(decode(data))) as Ticket;
    return ticket.expires > Date.now() ? ticket : null;
  } catch { return null; }
}
async function json(request: Request) {
  const body = await request.text();
  if (body.length > 64 * 1024) throw new Error("Request too large");
  return JSON.parse(body);
}

// Only the start request carries the Studio user's existing Sanity session.
// The atomic create/delete checks mix write permission without leaving a document.
async function canUpload(request: Request, env: Env) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const id = `upload-permission-${crypto.randomUUID()}`;
  const result = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
    method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations: [{ create: { _id: id, _type: "mix" } }, { delete: { id } }] })
  });
  await result.body?.cancel();
  return result.ok;
}

export async function handleAudioUpload(request: Request, env: Env) {
  const origin = request.headers.get("origin") || "";
  if (!origins.has(origin)) return new Response("Origin refused", { status: 403 });
  const headers = {
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type", "Vary": "Origin", "Cache-Control": "no-store"
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  const url = new URL(request.url);
  try {
    if (url.pathname === "/uploads/start" && request.method === "POST") {
      if (!await canUpload(request, env)) return respond({ error: "Sign in to Studio with mix edit permission." }, 403);
      const body = await json(request) as { filename: string; size: number; mixId: string };
      if (!/^[a-zA-Z0-9_-]+$/.test(body.mixId) || !/\.(wav|flac)$/i.test(body.filename)
        || !Number.isSafeInteger(body.size) || body.size <= 0 || body.size > 5 * 1024 ** 3) return respond({ error: "Select a WAV or FLAC master, up to 5 GB." }, 400);
      const id = `r2-${crypto.randomUUID()}`;
      const filename = body.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-180);
      const key = `mixes/${body.mixId}/${id}-${filename}`;
      const upload = await env.AUDIO.createMultipartUpload(key, { httpMetadata: { contentType: /\.flac$/i.test(filename) ? "audio/flac" : "audio/wav", cacheControl: "public, max-age=31536000, immutable" } });
      const ticket = { key, id, uploadId: upload.uploadId, filename: body.filename, size: body.size, expires: Date.now() + 24 * 60 * 60 * 1000 };
      return respond({ token: await sign(ticket, env.SANITY_WEBHOOK_SECRET), partBytes: AUDIO_PART_BYTES });
    }
    const ticket = await verify(request.headers.get("authorization")?.replace(/^Bearer /, "") || "", env.SANITY_WEBHOOK_SECRET);
    if (!ticket) return respond({ error: "Upload session expired. Select the file again." }, 401);
    const upload = env.AUDIO.resumeMultipartUpload(ticket.key, ticket.uploadId);
    if (url.pathname === "/uploads/part" && request.method === "PUT") {
      const part = Number(url.searchParams.get("part"));
      const count = Math.ceil(ticket.size / AUDIO_PART_BYTES);
      const expected = Math.min(AUDIO_PART_BYTES, ticket.size - (part - 1) * AUDIO_PART_BYTES);
      if (!Number.isInteger(part) || part < 1 || part > count || Number(request.headers.get("content-length")) !== expected) return respond({ error: "Invalid audio part size." }, 400);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength !== expected) return respond({ error: "Incomplete audio part." }, 400);
      return respond(await upload.uploadPart(part, bytes));
    }
    if (url.pathname === "/uploads/complete" && request.method === "POST") {
      const { parts } = await json(request) as { parts: Part[] };
      if (!Array.isArray(parts) || parts.length !== Math.ceil(ticket.size / AUDIO_PART_BYTES)
        || parts.some((p, i) => p.partNumber !== i + 1 || typeof p.etag !== "string" || p.etag.length > 200)) return respond({ error: "Audio parts are incomplete." }, 400);
      let object = await env.AUDIO.get(ticket.key, { range: new Headers({ Range: "bytes=0-131071" }) });
      if (!object) {
        await upload.complete(parts);
        object = await env.AUDIO.get(ticket.key, { range: new Headers({ Range: "bytes=0-131071" }) });
      }
      if (!object || object.size !== ticket.size) return respond({ error: "Saved audio size does not match the master." }, 422);
      const prefix = new Uint8Array(await new Response(object.body).arrayBuffer());
      if (!wavInfo(prefix) && !flacInfo(prefix)) return respond({ error: "Use a valid PCM WAV, float WAV, or FLAC master." }, 422);
      const base = env.AUDIO_PUBLIC_BASE_URL.replace(/\/+$/, "").replace(/\/audio$/, "");
      return respond({ r2Key: ticket.key, r2Id: ticket.id, filename: ticket.filename, size: ticket.size,
        url: `${base}/audio/${ticket.key.split("/").map(encodeURIComponent).join("/")}`,
        duration: durationSecondsFromAudio(prefix, object.size) });
    }
    if (url.pathname === "/uploads/abort" && request.method === "DELETE") { await upload.abort(); return respond({ cancelled: true }); }
    return respond({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Audio multipart request failed", error instanceof Error ? error.message : "Unknown error");
    return respond({ error: "Cloudflare could not save this audio part. Retry the upload." }, 503);
  }
}
