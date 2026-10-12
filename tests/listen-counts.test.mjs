import assert from "node:assert/strict";
import test from "node:test";
import { handleListenCounts, publicYoutubeViews } from "../workers/listen-counts.ts";
import { getMixListenCount } from "../lib/mix-listens.ts";

const env = { SANITY_API_PROJECT_ID: "project", SANITY_API_DATASET: "production", SANITY_API_WRITE_TOKEN: "test", YOUTUBE_API_KEY: "test", SANITY_WEBHOOK_SECRET: "test-signing-secret", LISTEN_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const video = "https://www.youtube.com/watch?v=fw2mtwgCeGo";
function post(body, headers = {}) {
  return new Request("https://worker.example/listen-counts", { method: "POST", headers: { Origin: "https://lowkalfm.in", "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers }, body: JSON.stringify(body) });
}
const get = () => new Request("https://worker.example/listen-counts?mix=test-mix");
function withBackend(run) {
  const previous = globalThis.fetch;
  const state = { listens: new Map(), snapshot: null, web: 4, baseline: 100, youtube: 300, failures: 0, conflicts: 0, oldDays: [], oldIds: new Set(), youtubeSnapshot: null, videoUrl: video, youtubeRequests: 0 };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/data/mutate/")) {
      const mutation = JSON.parse(String(init.body)).mutations[0];
      if ((mutation.create?._id ?? mutation.patch?.id)?.startsWith("youtube-view-")) {
        state.youtubeSnapshot = { ...(mutation.create ?? state.youtubeSnapshot), ...(mutation.patch?.set ?? {}), _rev: "yt-revision" };
        return Response.json({});
      }
      if (mutation.createIfNotExists) state.listens.set(mutation.createIfNotExists._id, mutation.createIfNotExists);
      else {
        if (state.failures) { state.failures--; return new Response("failed", { status: 500 }); }
        if (state.conflicts) { state.conflicts--; state.snapshot = { _id: "count", _rev: "new", baseline: 100, web: 10, youtube: 500, total: 610 }; return new Response("conflict", { status: 409 }); }
        if (mutation.create && state.snapshot || mutation.patch && mutation.patch.ifRevisionID !== state.snapshot?._rev) return new Response("conflict", { status: 409 });
        state.snapshot = { ...(mutation.create ?? state.snapshot), ...(mutation.patch?.set ?? {}), _rev: crypto.randomUUID() };
      }
      return Response.json({});
    }
    if (url.hostname === "www.youtube.com") { state.youtubeRequests++; return new Response("Consent required", { status: 503 }); }
    if (url.hostname === "www.googleapis.com") return Response.json({ items: [{ statistics: { viewCount: String(state.youtube) } }] });
    const query = url.searchParams.get("query") || "";
    assert.equal(url.searchParams.get("perspective"), "published");
    if (query.includes("checkedAt")) return Response.json({ result: state.youtubeSnapshot });
    if (query.includes("baseline,web,youtube,total")) return Response.json({ result: state.snapshot });
    if (query.includes("array::unique")) return Response.json({ result: state.oldDays });
    if (query.includes("visitorHash")) {
      const hash = JSON.parse(url.searchParams.get("$visitorHash"));
      const ids = JSON.parse(url.searchParams.get("$oldIds"));
      return Response.json({ result: [...state.listens.values()].filter((doc) => doc.visitorHash === hash).length + ids.filter((id) => state.oldIds.has(id)).length });
    }
    if (query.includes("count(")) return Response.json({ result: state.web + state.listens.size });
    if (query.includes("mixLegacyCountSample")) throw new Error("Untrusted legacy samples must not be read");
    return Response.json({ result: { _id: "mix-test", _rev: "revision", listenCount: state.baseline, legacyBaselineMax: 100000, youtubeVideoUrl: state.videoUrl } });
  };
  return Promise.resolve().then(() => run(state)).finally(() => { globalThis.fetch = previous; });
}

test("total uses saved history plus website plays plus YouTube; browser samples are ignored", () => withBackend(async () => {
  assert.deepEqual(await (await handleListenCounts(get(), env)).json(), { mix: "test-mix", baseline: 100, web: 4, youtube: 300, total: 404, youtubeStatus: "current" });
}));

test("missing baselines display zero instead of generated counts", () => {
  assert.equal(getMixListenCount("test"), 0);
  assert.equal(getMixListenCount("test", 0), 0);
  assert.equal(getMixListenCount("test", 554), 554);
  assert.equal(getMixListenCount("test", -1), 0);
});

test("arbitrary visitor IDs and legacy migration requests cannot create counts", () => withBackend(async (state) => {
  assert.equal((await handleListenCounts(post({ action: "migrate", mix: "test-mix", visitor: crypto.randomUUID(), legacyCount: 100000 }), env)).status, 400);
  assert.equal((await handleListenCounts(post({ mix: "test-mix", visitor: crypto.randomUUID() }), env)).status, 400);
  assert.equal((await handleListenCounts(new Request("https://worker.example/listen-counts", { method: "POST", body: '{}' }), env)).status, 403);
  assert.equal(state.listens.size, 0);
}));

test("signed tickets require elapsed time and deduplicate a visitor each day", () => withBackend(async (state) => {
  const originalNow = Date.now;
  const startTime = originalNow();
  try {
    const started = await handleListenCounts(post({ action: "start", mix: "test-mix" }), env);
    const { ticket, visitorToken } = await started.json();
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket }), env)).status, 403);
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "other-mix", ticket }), env)).status, 403);
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket: `${ticket}x` }), env)).status, 403);
    Date.now = () => startTime + 31_000;
    for (let i = 0; i < 2; i++) assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket }), env)).status, 200);
    assert.equal(state.listens.size, 1);
    Date.now = () => startTime + 86_400_000;
    const next = await (await handleListenCounts(post({ action: "start", mix: "test-mix", visitorToken }), env)).json();
    Date.now = () => startTime + 86_431_000;
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket: next.ticket }), env)).status, 200);
    assert.equal(state.listens.size, 2);
    assert.equal((await handleListenCounts(post({ action: "listen", mix: "test-mix", ticket }), env)).status, 403);
  } finally { Date.now = originalNow; }
}));

test("saved counts survive lower CMS values, removed web records and unavailable YouTube", () => withBackend(async (state) => {
  await handleListenCounts(get(), env);
  state.baseline = 0; state.web = 0;
  const originalNow = Date.now;
  const later = originalNow() + 3 * 86_400_000;
  try {
    Date.now = () => later;
    assert.deepEqual(await (await handleListenCounts(get(), { ...env, YOUTUBE_API_KEY: undefined })).json(), { mix: "test-mix", baseline: 100, web: 4, youtube: 300, total: 404, youtubeStatus: "saved" });
  } finally { Date.now = originalNow; }
}));

test("concurrent count writes retry and retain the larger committed total", () => withBackend(async (state) => {
  state.conflicts = 1;
  assert.equal((await (await handleListenCounts(get(), env)).json()).total, 610);
}));

test("failed persistence does not return an unsaved total", () => withBackend(async (state) => {
  state.failures = 1;
  await assert.rejects(handleListenCounts(get(), env), /Count write failed/);
}));

test("rate limiting applies before a new signed visitor is issued", async () => {
  const response = await handleListenCounts(post({ action: "start", mix: "test-mix" }), { ...env, LISTEN_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(response.status, 429);
});

test("public YouTube metadata belongs to the linked video and uses exact views", () => {
  const id = "other123456";
  const html = 'var ytInitialPlayerResponse = ' + JSON.stringify({ videoDetails: { videoId: id, title: 'A } ; " title', viewCount: '1234' }, other: { viewCount: '999999' } }) + ';';
  assert.equal(publicYoutubeViews(html, id), 1234);
  assert.equal(publicYoutubeViews(html, "wrong123456"), null);
  assert.equal(publicYoutubeViews('Consent required', id), null);
  assert.equal(publicYoutubeViews('ytInitialPlayerResponse = {bad};', id), null);
});

test("public watch-page views work when player metadata is unavailable", () => {
  const id = "public12345";
  const page = (views, videoId = id) => 'var ytInitialData = ' + JSON.stringify({ currentVideoEndpoint: { watchEndpoint: { videoId } }, contents: { twoColumnWatchNextResults: { results: { results: { contents: [{ videoPrimaryInfoRenderer: { viewCount: { videoViewCountRenderer: { viewCount: { simpleText: views }, shortViewCount: { simpleText: '1.2K views' } } } } }] } } } } }) + ';';
  assert.equal(publicYoutubeViews(page('1,234 views'), id), 1234);
  assert.equal(publicYoutubeViews(page('1 view'), id), 1);
  assert.equal(publicYoutubeViews(page('1.2K views'), id), null);
  assert.equal(publicYoutubeViews(page('1,234 views', 'wrong123456'), id), null);
});

test("a shared recent snapshot prevents another YouTube request", () => withBackend(async (state) => {
  state.videoUrl = "https://youtu.be/shared12345";
  state.youtubeSnapshot = { _rev: "yt", count: 789, checkedAt: Date.now() };
  const result = await (await handleListenCounts(get(), { ...env, YOUTUBE_API_KEY: undefined })).json();
  assert.equal(result.youtube, 789);
  assert.equal(state.youtubeRequests, 0);
}));

test("a failed YouTube refresh has a shared one-hour retry limit", () => withBackend(async (state) => {
  state.videoUrl = "https://youtu.be/failed12345";
  for (let i = 0; i < 2; i++) await handleListenCounts(get(), { ...env, YOUTUBE_API_KEY: undefined });
  assert.equal(state.youtubeRequests, 1);
}));
