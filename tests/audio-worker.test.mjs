import assert from "node:assert/strict";
import test from "node:test";
import worker from "../workers/audio-sync.ts";

const secret = "test-webhook-secret";
const master = "file-aabbcc-wav";
const mp3 = "file-ddeeff-mp3";
const sourceUrl = "https://cdn.sanity.io/files/project/production/aabbcc.wav";
const deliveryUrl = "https://cdn.sanity.io/files/project/production/ddeeff.mp3";
const waveformUrl = "https://cdn.sanity.io/files/project/production/waveform.json";
async function signature(body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return `t=${timestamp},v1=${Buffer.from(digest).toString("base64url")}`;
}
async function sync(options = {}) {
  const previous = globalThis.fetch;
  const writes = [], mutations = [], requests = [];
  let activeMaster = master;
  const payload = JSON.stringify({ _id: "mix-test", _type: "mix", audioMasterUrl: sourceUrl, audioMasterFilename: "Test.wav", audioMasterId: options.deriveId ? null : master });
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push({ url, init });
    if (url.includes("/data/query/")) return Response.json({ result: { _rev: "current-revision", master: activeMaster, delivery: mp3, deliveryId: mp3, deliveryUrl, waveformId: "file-peaks-json", waveformUrl } });
    if (url === sourceUrl) return new Response(options.invalidWav ? "FLAC" : wavHeader(options.seconds ?? 2), { headers: { "content-type": "audio/wav" } });
    if (url === waveformUrl) return Response.json({ version: 1, sourceAssetId: options.wrongPeaks ? "file-old-wav" : master, peaks: Array(128).fill(.5) });
    if (url === deliveryUrl) return new Response("MP3 audio");
    if (init?.method === "POST") { mutations.push(JSON.parse(init.body)); return Response.json({}); }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/sanity/audio-sync", { method: "POST", headers: { "sanity-webhook-signature": await signature(payload) }, body: payload }), {
      AUDIO: { put: async (key, value, metadata) => { writes.push({ key, bytes: new Uint8Array(await new Response(value).arrayBuffer()), metadata }); if (options.newMaster) activeMaster = "file-new-master-wav"; } },
      SANITY_WEBHOOK_SECRET: secret, SANITY_API_PROJECT_ID: "project", SANITY_API_DATASET: "production", SANITY_API_WRITE_TOKEN: "token", AUDIO_PUBLIC_BASE_URL: "https://worker.example/"
    });
    return { response, writes, mutations, requests };
  } finally { globalThis.fetch = previous; }
}

test("audio delivery allows the production site origin", async () => {
  const response = await worker.fetch(new Request("https://worker.example/audio/mix.mp3", { headers: { origin: "https://lowkalfm.in" } }), { AUDIO: { get: async () => ({ body: new Blob(["audio"]).stream(), size: 5, etag: "test-etag", httpMetadata: { contentType: "audio/mpeg" } }) } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://lowkalfm.in");
  assert.equal(response.headers.get("vary"), "Origin");
});

test("audio sync derives the master ID and copies only the prepared MP3", async () => {
  const { response, writes, mutations, requests } = await sync({ deriveId: true });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.deliveryUrl, "https://worker.example/audio/mixes/mix-test/file-aabbcc-wav-file-ddeeff-mp3.mp3");
  assert.equal(new TextDecoder().decode(writes[0].bytes), "MP3 audio");
  assert.equal(writes[0].metadata.httpMetadata.contentType, "audio/mpeg");
  assert.equal(writes.length, 2);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(writes[1].bytes)), { version: 1, peaks: Array(128).fill(.5) });
  const patch = mutations[0].mutations[0].patch;
  assert.equal(patch.ifRevisionID, "current-revision");
  assert.equal(patch.set["audio.sourceAssetId"], master);
  assert.equal(patch.set["audio.sourceDeliveryAssetId"], mp3);
  assert.equal(patch.set["audio.peaksUrl"], result.peaksUrl);
  assert.equal(patch.set.duration, 2);
  assert.equal(requests.find(request => request.url === sourceUrl).init.headers.Range, "bytes=0-131071");
});

test("long mix duration comes from the small WAV header", async () => {
  const { response, mutations } = await sync({ seconds: 90 });
  assert.equal(response.status, 200);
  assert.equal(mutations[0].mutations[0].patch.set.duration, 90);
});

test("an older upload cannot replace a newer master", async () => {
  const { response, mutations } = await sync({ newMaster: true });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).published, false);
  assert.equal(mutations.length, 0);
});

test("waveform data from a different master is rejected before upload", async () => {
  const { response, writes } = await sync({ wrongPeaks: true });
  assert.equal(response.status, 422);
  assert.equal(writes.length, 0);
});

test("non-WAV archive masters are rejected before upload", async () => {
  const { response, writes } = await sync({ invalidWav: true });
  assert.equal(response.status, 422);
  assert.equal(writes.length, 0);
});

function wavHeader(seconds = 2) {
  const byteRate = 176400;
  const dataBytes = byteRate * seconds;
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const write = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
}
