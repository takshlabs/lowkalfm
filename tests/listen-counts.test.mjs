import assert from "node:assert/strict";
import test from "node:test";
import { handleListenCounts } from "../workers/listen-counts.ts";

const env = { SANITY_API_PROJECT_ID: "project", SANITY_API_DATASET: "production", SANITY_API_WRITE_TOKEN: "test", YOUTUBE_API_KEY: "test", SANITY_WEBHOOK_SECRET: "test-signing-secret", LISTEN_RATE_LIMITER: { limit: async () => ({ success: true }) } };
function post(body, headers = {}) {
  return new Request("https://worker.example/listen-counts", { method: "POST", headers: { Origin: "https://lowkalfm.in", "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers }, body: JSON.stringify(body) });
}
function withBackend(run) {
  const previous = globalThis.fetch;
  const created = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/data/mutate/")) {
      const mutation = JSON.parse(String(init.body)).mutations[0];
      if (mutation.createIfNotExists) created.push(mutation.createIfNotExists._id);
      return Response.json({});
    }
    if (url.hostname === "www.googleapis.com") return Response.json({ items: [{ statistics: { viewCount: "300" } }] });
    const query = url.searchParams.get("query") || "";
    if (query.includes("count(")) return Response.json({ result: 4 });
    if (query.includes("mixLegacyCountSample")) throw new Error("Untrusted legacy samples must not be read");
    return Response.json({ result: { _id: "mix-test", _rev: "revision", listenCount: 100, legacyBaselineMax: 100000, youtubeVideoUrl: "https://www.youtube.com/watch?v=fw2mtwgCeGo" } });
  };
  return Promise.resolve().then(() => run(created)).finally(() => { globalThis.fetch = previous; });
}

test("total uses the editor baseline and ignores browser legacy snapshots", () => withBackend(async () => {
  const response = await handleListenCounts(new Request("https://worker.example/listen-counts?mix=test-mix"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mix: "test-mix", baseline: 100, web: 4, youtube: 300, total: 404 });
}));

test("arbitrary visitor IDs and legacy migration requests cannot create counts", () => withBackend(async (created) => {
  assert.equal((await handleListenCounts(post({ action: "migrate", mix: "test-mix", visitor: crypto.randomUUID(), legacyCount: 100000 }), env)).status, 400);
  assert.equal((await handleListenCounts(post({ mix: "test-mix", visitor: crypto.randomUUID() }), env)).status, 400);
  assert.equal((await handleListenCounts(new Request("https://worker.example/listen-counts", { method: "POST", body: '{}' }), env)).status, 403);
  assert.equal(created.length, 0);
}));

test("signed tickets require elapsed time and deduplicate a visitor by UTC day", () => withBackend(async (created) => {
  const originalNow = Date.now;
  const startTime = originalNow();
  try {
    const started = await handleListenCounts(post({ action: "start", mix: "test-mix" }), env);
    assert.equal(started.status, 200);
    const { ticket, visitorToken } = await started.json();
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket }), env)).status, 403);
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "other-mix", ticket }), env)).status, 403);
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket: `${ticket}x` }), env)).status, 403);
    Date.now = () => startTime + 31_000;
    for (let i = 0; i < 2; i++) assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket }), env)).status, 200);
    assert.equal(created.length, 2);
    assert.equal(created[0], created[1]);
    const second = await handleListenCounts(post({ action: "start", mix: "test-mix", visitorToken }), env);
    const next = await second.json();
    Date.now = () => startTime + 62_000;
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket: next.ticket }), env)).status, 200);
    assert.equal(created[2], created[0]);
    Date.now = () => startTime + 31 * 60_000;
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket }), env)).status, 403);
  } finally { Date.now = originalNow; }
}));

test("rate limiting applies before a new signed visitor is issued", async () => {
  const response = await handleListenCounts(post({ action: "start", mix: "test-mix" }), { ...env, LISTEN_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(response.status, 429);
});
