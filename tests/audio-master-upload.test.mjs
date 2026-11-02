import assert from "node:assert/strict";
import test from "node:test";
import { uploadAudioMaster } from "../lib/audio-master-upload.ts";
const partBytes = 8 * 1024 * 1024;
const master = { r2Id: "r2-test", r2Key: "mixes/test/r2-test.wav", filename: "master.wav", size: partBytes + 4, url: "https://worker/audio/master.wav", duration: 10 };
const client = { create: async permit => { assert.equal(permit._type, "lowkalAudioUploadPermit"); assert.match(permit.secretHash, /^[a-f0-9]{64}$/); return permit; } };
function fixture() {
  let value;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, removeItem: () => { value = undefined; } };
}
const file = new File([new Uint8Array(partBytes + 4)], "master.wav", { lastModified: 100 });
const options = storage => ({ mixId: "test", signal: new AbortController().signal, onAttempt() {}, onProgress() {}, retryMs: 1, storage });

test("a failed part retries without resending completed parts or changing audio bytes", async () => {
  const original = globalThis.fetch;
  const calls = [];
  let failures = 0;
  globalThis.fetch = async (url, init) => {
    const path = String(url).split("/uploads/")[1];
    calls.push(path);
    if (path === "start") { assert.match(init.headers.Authorization, /^Bearer [a-f0-9-]{72}$/); return Response.json({ token: "test-scoped-ticket", partBytes }); }
    assert.equal(init.headers.Authorization, "Bearer test-scoped-ticket");
    if (path === "part?part=2" && failures++ === 0) throw new Error("network interrupted");
    if (path.startsWith("part")) {
      const n = Number(path.split("=")[1]);
      assert.deepEqual(new Uint8Array(await init.body.arrayBuffer()), new Uint8Array(await file.slice((n - 1) * partBytes, n * partBytes).arrayBuffer()));
      return Response.json({ partNumber: n, etag: `etag-${n}` });
    }
    assert.deepEqual(JSON.parse(init.body).parts, [{ partNumber: 1, etag: "etag-1" }, { partNumber: 2, etag: "etag-2" }]);
    return Response.json(master);
  };
  try {
    assert.deepEqual(await uploadAudioMaster(client, file, options(fixture())), master);
    assert.deepEqual(calls, ["start", "part?part=1", "part?part=2", "part?part=2", "complete"]);
  } finally { globalThis.fetch = original; }
});

test("reselecting the same file resumes saved parts after all retries fail", async () => {
  const original = globalThis.fetch;
  const storage = fixture();
  const calls = [];
  let failing = true;
  globalThis.fetch = async url => {
    const path = String(url).split("/uploads/")[1]; calls.push(path);
    if (path === "start") return Response.json({ token: "ticket", partBytes });
    if (path === "part?part=2" && failing) throw new Error("network interrupted");
    if (path.startsWith("part")) return Response.json({ partNumber: Number(path.split("=")[1]), etag: "etag" });
    return Response.json(master);
  };
  try {
    await assert.rejects(uploadAudioMaster(client, file, options(storage)), /network interrupted/);
    failing = false;
    assert.deepEqual(await uploadAudioMaster(client, file, options(storage)), master);
    assert.equal(calls.filter(p => p === "start").length, 1);
    assert.equal(calls.filter(p => p === "part?part=1").length, 1);
    assert.equal(calls.filter(p => p === "part?part=2").length, 4);
  } finally { globalThis.fetch = original; }
});

test("permission errors stop immediately and cancellation starts no request", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: "permission refused" }, { status: 403 }); };
  try {
    await assert.rejects(uploadAudioMaster(client, file, options(fixture())), /permission refused/);
    assert.equal(calls, 1);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(uploadAudioMaster(client, file, { ...options(fixture()), signal: controller.signal }), { name: "AbortError" });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("a lost completion response can repeat completion without resending audio", async () => {
  const original = globalThis.fetch;
  const storage = fixture();
  let completions = 0;
  const calls = [];
  globalThis.fetch = async url => {
    const path = String(url).split("/uploads/")[1]; calls.push(path);
    if (path === "start") return Response.json({ token: "ticket", partBytes });
    if (path.startsWith("part")) return Response.json({ partNumber: Number(path.split("=")[1]), etag: "etag" });
    if (++completions < 4) throw new Error("response lost");
    return Response.json(master);
  };
  try {
    await assert.rejects(uploadAudioMaster(client, file, options(storage)), /response lost/);
    await uploadAudioMaster(client, file, options(storage));
    assert.equal(calls.filter(p => p.startsWith("part")).length, 2);
    assert.equal(completions, 4);
  } finally { globalThis.fetch = original; }
});
