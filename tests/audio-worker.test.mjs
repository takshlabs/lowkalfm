import assert from "node:assert/strict";
import test from "node:test";
import worker from "../workers/audio-sync.ts";

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function signature(body, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return `t=${timestamp},v1=${base64Url(digest)}`;
}

test("audio sync derives a missing asset ID and returns a playable delivery URL", async () => {
  const secret = "test-webhook-secret";
  const sourceUrl = "https://cdn.sanity.io/files/project/production/aabbcc.wav";
  const payload = JSON.stringify({
    _id: "mix-test",
    _type: "mix",
    audioMasterUrl: sourceUrl,
    audioMasterFilename: "Test.wav",
    audioMasterId: null,
    audioSourceAssetId: null,
  });
  const writes = [];
  const mutations = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === sourceUrl) return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200, headers: { "content-type": "audio/wav" } });
    if (url.includes("api.sanity.io") && init?.method === "POST") {
      mutations.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await worker.fetch(new Request("https://worker.example/sanity/audio-sync", {
      method: "POST",
      headers: { "sanity-webhook-signature": await signature(payload, secret) },
      body: payload,
    }), {
      AUDIO: {
        get: async () => null,
        put: async (key, value, options) => {
          writes.push({ key, bytes: new Uint8Array(await new Response(value).arrayBuffer()), options });
        },
      },
      SANITY_WEBHOOK_SECRET: secret,
      SANITY_API_PROJECT_ID: "project",
      SANITY_API_DATASET: "production",
      SANITY_API_WRITE_TOKEN: "token",
      AUDIO_PUBLIC_BASE_URL: "https://worker.example/",
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.deliveryUrl, "https://worker.example/audio/mixes/mix-test/file-aabbcc-wav-Test.wav");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, "mixes/mix-test/file-aabbcc-wav-Test.wav");
    assert.deepEqual([...writes[0].bytes], [82, 73, 70, 70]);
    assert.equal(mutations.length, 1);
    assert.equal(mutations[0].mutations[0].patch.set["audio.sourceAssetId"], "file-aabbcc-wav");
    assert.equal(mutations[0].mutations[0].patch.set["audio.deliveryUrl"], result.deliveryUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
