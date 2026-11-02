import assert from "node:assert/strict";
import test from "node:test";
import { handleAudioUpload, AUDIO_PART_BYTES } from "../workers/audio-upload.ts";
const origin = "https://lowkalfm.in";
const wav = () => {
  const bytes = new Uint8Array(48); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF")); view.setUint32(4, 40, true);
  bytes.set(new TextEncoder().encode("WAVEfmt "), 8); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 44100, true);
  view.setUint32(28, 88200, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  bytes.set(new TextEncoder().encode("data"), 36); view.setUint32(40, 4, true); return bytes;
};
function setup() {
  let saved; let completes = 0; const parts = [];
  const env = { SANITY_WEBHOOK_SECRET: "test-only-secret", SANITY_API_PROJECT_ID: "test", SANITY_API_DATASET: "production", AUDIO_PUBLIC_BASE_URL: "https://worker.example", AUDIO: {
    createMultipartUpload: async () => ({ uploadId: "scoped-upload" }),
    resumeMultipartUpload: () => ({ uploadPart: async (n, data) => { parts.push(new Uint8Array(data)); return { partNumber: n, etag: "etag" }; }, complete: async () => { completes++; saved = wav(); }, abort: async () => {} }),
    get: async () => saved ? { size: saved.length, body: new Blob([saved]).stream() } : null
  } };
  const request = (path, method, body, token = "studio-session", extra = {}) => handleAudioUpload(new Request(`https://worker.example/uploads/${path}`, { method, headers: { origin, Authorization: `Bearer ${token}`, ...extra }, ...(body ? { body } : {}) }), env);
  return { request, parts, completes: () => completes };
}

test("multipart upload checks mix write permission, binds a ticket, validates bytes and completes idempotently", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /test.api.sanity.io.*data\/mutate\/production/);
    assert.equal(init.headers.Authorization, "Bearer studio-session");
    const mutations = JSON.parse(init.body).mutations;
    assert.equal(mutations[0].create._type, "mix");
    assert.equal(mutations[0].create._id, mutations[1].delete.id);
    return Response.json({});
  };
  try {
    const f = setup();
    const start = await f.request("start", "POST", JSON.stringify({ filename: "master.wav", size: 48, mixId: "mix-test" }));
    assert.equal(start.status, 200); const { token, partBytes } = await start.json(); assert.equal(partBytes, AUDIO_PART_BYTES);
    assert.equal((await f.request("part?part=1", "PUT", wav(), token + "tampered", { "Content-Length": "48" })).status, 401);
    assert.equal((await f.request("part?part=2", "PUT", wav(), token, { "Content-Length": "48" })).status, 400);
    const part = await f.request("part?part=1", "PUT", wav(), token, { "Content-Length": "48" }); assert.equal(part.status, 200);
    assert.deepEqual(f.parts[0], wav());
    const body = JSON.stringify({ parts: [await part.json()] });
    const complete = await f.request("complete", "POST", body, token); assert.equal(complete.status, 200);
    const master = await complete.json(); assert.match(master.r2Key, /^mixes\/mix-test\/r2-/); assert.equal(master.size, 48); assert.equal(master.duration, 1);
    assert.equal((await f.request("complete", "POST", body, token)).status, 200); assert.equal(f.completes(), 1);
    assert.equal(complete.headers.get("access-control-allow-origin"), origin);
  } finally { globalThis.fetch = original; }
});

test("no write permission, bad origin, and missing upload ticket cannot write R2", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Forbidden", { status: 403 });
  try {
    const f = setup();
    assert.equal((await f.request("start", "POST", JSON.stringify({ filename: "master.wav", size: 48, mixId: "mix" }))).status, 403);
    assert.equal((await f.request("part?part=1", "PUT", wav())).status, 401);
    assert.equal((await f.request("start", "OPTIONS", undefined)).status, 204);
    assert.equal(f.parts.length, 0);
    const bad = await handleAudioUpload(new Request("https://worker.example/uploads/start", { method: "POST", headers: { origin: "https://untrusted.example" } }), {});
    assert.equal(bad.status, 403);
  } finally { globalThis.fetch = original; }
});

test("cookie-based Studio can authorize uploads with a hashed permit and no session token", async () => {
  const original = globalThis.fetch;
  const secret = "one-use-secret";
  const secretHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))).toString("hex");
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /data\/query/);
    assert.notEqual(init.headers.Authorization, `Bearer ${secret}`, "the upload secret is not a Sanity session");
    return Response.json({ result: { secretHash, expires: Date.now() + 60000, mixId: "mix", filename: "master.wav", size: 48 } });
  };
  try {
    const f = setup();
    const body = JSON.stringify({ filename: "master.wav", size: 48, mixId: "mix", permitId: "audio-upload-permit-00000000-0000-0000-0000-000000000000" });
    assert.equal((await f.request("start", "POST", body, "incorrect-secret")).status, 403);
    assert.equal((await f.request("start", "POST", body, secret)).status, 200);
  } finally { globalThis.fetch = original; }
});
