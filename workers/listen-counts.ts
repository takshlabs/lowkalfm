const encoder = new TextEncoder();
const DAY_MS = 86_400_000;
const youtubeCache = new Map<string, { count: number; expiresAt: number }>();

type CountEnv = {
  SANITY_API_PROJECT_ID: string;
  SANITY_API_DATASET: string;
  SANITY_API_WRITE_TOKEN: string;
  YOUTUBE_API_KEY?: string;
  SANITY_WEBHOOK_SECRET: string;
  LISTEN_RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
};

function cors(request: Request) {
  const origin = request.headers.get("Origin");
  const allowed = origin === "https://lowkalfm.in" || origin === "http://localhost:3000" || origin === "http://localhost:5173";
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://lowkalfm.in", Vary: "Origin", "Cache-Control": "no-store" };
}

function validSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(slug);
}

async function sanityQuery<T>(env: CountEnv, query: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/query/${env.SANITY_API_DATASET}`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(`$${key}`, JSON.stringify(value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status}`);
  return ((await response.json()) as { result: T }).result;
}

async function mixInfo(env: CountEnv, slug: string) {
  return sanityQuery<{ _id: string; _rev: string; listenCount?: number; legacyBaselineMax?: number; youtubeViewsMax?: number; youtubeVideoUrl?: string; externalUrl?: string } | null>(env,
    '*[_type == "mix" && published == true && parked != true && slug.current == $slug][0]{_id,_rev,listenCount,legacyBaselineMax,youtubeViewsMax,youtubeVideoUrl,externalUrl}', { slug });
}

type CountSnapshot = { _id: string; _rev?: string; baseline?: number; web?: number; youtube?: number; total?: number };

function countValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function saveCounts(env: CountEnv, slug: string, mix: NonNullable<Awaited<ReturnType<typeof mixInfo>>>, web: number, observedYoutube: number | null) {
  const id = `mix-play-count-${await digest(mix._id)}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stored = await sanityQuery<CountSnapshot | null>(env, '*[_id == $id][0]{_id,_rev,baseline,web,youtube,total}', { id });
    const baseline = Math.max(countValue(stored?.baseline), countValue(mix.listenCount));
    const nextWeb = Math.max(countValue(stored?.web), countValue(web));
    const youtube = Math.max(countValue(stored?.youtube), countValue(mix.youtubeViewsMax), countValue(observedYoutube));
    const total = Math.max(countValue(stored?.total), baseline + nextWeb + youtube);
    const counts = { baseline, web: nextWeb, youtube, total };
    if (stored && Object.entries(counts).every(([key, value]) => stored[key as keyof typeof counts] === value)) return counts;
    // The count document is separate from the CMS mix. Publishing a draft cannot reset it.
    const mutation = stored ? { patch: { id, ifRevisionID: stored._rev, set: counts } } :
      { create: { _id: id, _type: "mixPlayCount", mixId: mix._id, mixSlug: slug, ...counts } };
    const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
      method: "POST", headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [mutation] })
    });
    if (response.ok) return counts;
    if (response.status !== 409) throw new Error(`Count write failed: ${response.status}`);
  }
  // Do not return a value from a write that lost a concurrent update.
  throw new Error("Count write conflict");
}

function videoId(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const candidate = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1).split("/")[0] :
      parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com") ?
        parsed.pathname === "/watch" ? parsed.searchParams.get("v") : /^\/(embed|live|shorts)\//.test(parsed.pathname) ? parsed.pathname.split("/")[2] : null : null;
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch { return null; }
}

function youtubePageData(html: string, variable: "ytInitialPlayerResponse" | "ytInitialData"): unknown {
  const marker = new RegExp(`${variable}\\s*=\\s*`).exec(html);
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  if (html[start] !== "{") return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, index + 1)) as unknown;
      } catch { return null; }
    }
  }
  return null;
}

export function publicYoutubeViews(html: string, id: string): number | null {
  const player = youtubePageData(html, "ytInitialPlayerResponse") as { videoDetails?: { videoId?: string; viewCount?: string }; playabilityStatus?: { status?: string; reason?: string } } | null;
  const count = Number(player?.videoDetails?.viewCount);
  if (player?.videoDetails?.videoId === id && Number.isSafeInteger(count) && count >= 0) return count;
  // A public page can show views when its player requires sign-in.
  const data = youtubePageData(html, "ytInitialData") as {
    currentVideoEndpoint?: { watchEndpoint?: { videoId?: string } };
    contents?: { twoColumnWatchNextResults?: { results?: { results?: { contents?: Array<{
      videoPrimaryInfoRenderer?: { viewCount?: { videoViewCountRenderer?: { viewCount?: { simpleText?: string } } } };
    }> } } } };
  } | null;
  if (data?.currentVideoEndpoint?.watchEndpoint?.videoId !== id) {
    console.warn("YouTube public metadata missing", id, player?.playabilityStatus?.status, player?.playabilityStatus?.reason, data?.currentVideoEndpoint?.watchEndpoint?.videoId);
    return null;
  }
  const primary = data.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find((item) => item.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
  const text = primary?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText;
  if (!text || !/^[0-9][0-9,]* views?$/.test(text)) return null;
  const views = Number(text.replace(/[^0-9]/g, ""));
  return Number.isSafeInteger(views) && views >= 0 ? views : null;
}

async function readYoutubeViews(env: CountEnv, id: string): Promise<number | null> {
  let count: number | null;
  const signal = AbortSignal.timeout(12_000);
  if (env.YOUTUBE_API_KEY) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", id);
    url.searchParams.set("key", env.YOUTUBE_API_KEY);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`YouTube query failed: ${response.status}`);
    count = Number(((await response.json()) as { items?: Array<{ statistics?: { viewCount?: string } }> }).items?.[0]?.statistics?.viewCount);
  } else {
    // Use the linked video's own metadata, never counts from recommended videos.
    const response = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { signal });
    if (!response.ok) throw new Error(`YouTube page failed: ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4_000_000) { await reader.cancel(); return null; }
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } finally { reader.releaseLock(); }
    count = publicYoutubeViews(html, id);
    if (count === null) throw new Error(`YouTube metadata unavailable (${size} bytes)`);
  }
  if (count === null) return null;
  if (!Number.isSafeInteger(count) || count < 0) return null;
  return count;
}

async function youtubeViews(env: CountEnv, id: string | null): Promise<number | null> {
  if (!id) return null;
  const cached = youtubeCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.count;
  const documentId = `youtube-view-${id}`;
  type ViewSnapshot = { _rev: string; count?: number; checkedAt?: number };
  const stored = await sanityQuery<ViewSnapshot | null>(env, '*[_id == $id][0]{_rev,count,checkedAt}', { id: documentId });
  const previous = stored && typeof stored.count === "number" && Number.isSafeInteger(stored.count) && stored.count >= 0 ? stored.count : null;
  const interval = 60 * 60 * 1000;
  if (stored?.checkedAt && stored.checkedAt + interval > Date.now()) {
    if (previous !== null) youtubeCache.set(id, { count: previous, expiresAt: stored.checkedAt + interval });
    return previous;
  }
  // Claim the refresh across Worker instances before requesting YouTube.
  const checkedAt = Date.now();
  const claim = stored ? { patch: { id: documentId, ifRevisionID: stored._rev, set: { checkedAt } } } :
    { create: { _id: documentId, _type: "youtubeViewSnapshot", videoId: id, checkedAt } };
  const endpoint = `https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`;
  const headers = { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" };
  const claimed = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ mutations: [claim] }) });
  if (claimed.status === 409) return previous;
  if (!claimed.ok) throw new Error(`YouTube refresh claim failed: ${claimed.status}`);
  const observed = await readYoutubeViews(env, id);
  if (observed === null) return previous;
  const count = Math.max(observed, previous ?? 0);
  const saved = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ mutations: [{ patch: { id: documentId, set: { count } } }] }) });
  if (!saved.ok) throw new Error(`YouTube snapshot write failed: ${saved.status}`);
  youtubeCache.set(id, { count, expiresAt: checkedAt + interval });
  return count;
}

async function webListens(env: CountEnv, slug: string) {
  return sanityQuery<number>(env, 'count(*[_type == "mixWebListen" && mixSlug == $slug])', { slug });
}

async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type ListenTicket = { kind: "visitor" | "listen"; visitor: string; expires: number; mix?: string; ready?: number };

async function signTicket(payload: ListenTicket, secret: string) {
  const data = btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`lowkal-listen-v1:${data}`));
  return `${data}.${Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function readTicket(value: unknown, kind: ListenTicket["kind"], secret: string): Promise<ListenTicket | null> {
  if (typeof value !== "string" || value.length > 2048) return null;
  const [data, signature, extra] = value.split(".");
  if (extra || !data || !/^[a-f0-9]{64}$/.test(signature ?? "")) return null;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const bytes = Uint8Array.from(signature.match(/../g)!, (byte) => parseInt(byte, 16));
    if (!await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`lowkal-listen-v1:${data}`))) return null;
    const ticket = JSON.parse(atob(data.replaceAll("-", "+").replaceAll("_", "/"))) as ListenTicket;
    return ticket.kind === kind && ticket.expires > Date.now() && typeof ticket.visitor === "string" ? ticket : null;
  } catch { return null; }
}

export async function handleListenCounts(request: Request, env: CountEnv): Promise<Response> {
  const headers = cors(request);
  const origin = request.headers.get("Origin");
  if ((origin && origin !== headers["Access-Control-Allow-Origin"]) || (request.method === "POST" && !origin)) return new Response("Forbidden", { status: 403, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (request.method !== "GET" && request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
  let body: { mix?: unknown; action?: unknown; visitorToken?: unknown; ticket?: unknown } | null = null;
  if (request.method === "POST") {
    if (!env.SANITY_WEBHOOK_SECRET || !env.LISTEN_RATE_LIMITER) return new Response("Count unavailable", { status: 503, headers });
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return new Response("Forbidden", { status: 403, headers });
    // Limit token creation too, so a new visitor ID cannot bypass the limit.
    if (!(await env.LISTEN_RATE_LIMITER.limit({ key: `listen:${ip}` })).success) return new Response("Too many requests", { status: 429, headers: { ...headers, "Retry-After": "60" } });
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return new Response("JSON required", { status: 415, headers });
    const reader = request.body?.getReader();
    let raw = "";
    if (reader) {
      const decoder = new TextDecoder();
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) { await reader.cancel(); return new Response("Request too large", { status: 413, headers }); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } finally { reader.releaseLock(); }
    }
    try { body = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400, headers }); }
    if (body?.action !== "start" && body?.action !== "listen") return new Response("Invalid action", { status: 400, headers });
  }
  const slug = request.method === "GET" ? new URL(request.url).searchParams.get("mix") : body?.mix;
  if (!validSlug(slug)) return Response.json({ error: "Invalid mix" }, { status: 400, headers });
  const mix = await mixInfo(env, slug);
  if (!mix) return Response.json({ error: "Mix not found" }, { status: 404, headers });
  if (body?.action === "start") {
    const previous = await readTicket(body.visitorToken, "visitor", env.SANITY_WEBHOOK_SECRET);
    const visitor = previous?.visitor ?? crypto.randomUUID();
    const visitorToken = await signTicket({ kind: "visitor", visitor, expires: Date.now() + 365 * DAY_MS }, env.SANITY_WEBHOOK_SECRET);
    const ticket = await signTicket({ kind: "listen", visitor, mix: slug, ready: Date.now() + 30_000, expires: Date.now() + 30 * 60_000 }, env.SANITY_WEBHOOK_SECRET);
    return Response.json({ visitorToken, ticket }, { headers });
  }
  if (body) {
    const ticket = await readTicket(body.ticket, "listen", env.SANITY_WEBHOOK_SECRET);
    if (!ticket || ticket.mix !== slug || !ticket.ready || ticket.ready > Date.now()) return Response.json({ error: "Invalid listen ticket" }, { status: 403, headers });
    const day = Math.floor(Date.now() / DAY_MS);
    const id = `mix-web-listen-${await digest(`${slug}:${ticket.visitor}:${day}`)}`;
    const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
      method: "POST", headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [{ createIfNotExists: { _id: id, _type: "mixWebListen", mixSlug: slug, day } }] })
    });
    if (!response.ok) throw new Error(`Sanity listen write failed: ${response.status}`);
  }
  const [web, observedYoutube] = await Promise.all([webListens(env, slug), youtubeViews(env, videoId(mix.youtubeVideoUrl) ?? videoId(mix.externalUrl)).catch((error: unknown) => {
    console.warn("YouTube count refresh unavailable", slug, error instanceof Error ? error.message : "Unknown error");
    return null;
  })]);
  const counts = await saveCounts(env, slug, mix, web, observedYoutube);
  return Response.json({ mix: slug, ...counts, youtubeStatus: observedYoutube === null ? "saved" : "current" }, { headers });
}
