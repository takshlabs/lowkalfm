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
  for (const [key, value] of Object.entries(params)) url.searchParams.set(`$${key}`, JSON.stringify(value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity query failed: ${response.status}`);
  return ((await response.json()) as { result: T }).result;
}

async function mixInfo(env: CountEnv, slug: string) {
  return sanityQuery<{ _id: string; _rev: string; listenCount?: number; legacyBaselineMax?: number; youtubeViewsMax?: number; youtubeVideoUrl?: string; externalUrl?: string } | null>(env,
    '*[_type == "mix" && published == true && parked != true && slug.current == $slug][0]{_id,_rev,listenCount,legacyBaselineMax,youtubeViewsMax,youtubeVideoUrl,externalUrl}', { slug });
}

async function keepMax(env: CountEnv, slug: string, mix: NonNullable<Awaited<ReturnType<typeof mixInfo>>>, field: "youtubeViewsMax" | "legacyBaselineMax", observed: number | null) {
  let stored = Math.max(0, Number(mix[field]) || 0);
  if (observed === null || observed <= stored) return stored;
  let current = mix;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://${env.SANITY_API_PROJECT_ID}.api.sanity.io/v2026-08-24/data/mutate/${env.SANITY_API_DATASET}`, {
      method: "POST", headers: { Authorization: `Bearer ${env.SANITY_API_WRITE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: [{ patch: { id: current._id, ifRevisionID: current._rev, set: { [field]: observed } } }] })
    });
    if (response.ok) return observed;
    if (response.status !== 409) throw new Error(`YouTube count write failed: ${response.status}`);
    const latest = await mixInfo(env, slug);
    if (!latest) return stored;
    stored = Math.max(stored, Number(latest[field]) || 0);
    if (stored >= observed) return stored;
    current = latest;
  }
  return stored;
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

async function youtubeViews(env: CountEnv, id: string | null): Promise<number | null> {
  if (!id || !env.YOUTUBE_API_KEY) return null;
  const cached = youtubeCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.count;
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", id);
  url.searchParams.set("key", env.YOUTUBE_API_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube query failed: ${response.status}`);
  const count = Number(((await response.json()) as { items?: Array<{ statistics?: { viewCount?: string } }> }).items?.[0]?.statistics?.viewCount);
  if (!Number.isSafeInteger(count) || count < 0) return null;
  const stable = Math.max(count, cached?.count ?? 0);
  youtubeCache.set(id, { count: stable, expiresAt: Date.now() + 60 * 60 * 1000 });
  return stable;
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
  const [web, observedYoutube] = await Promise.all([webListens(env, slug), youtubeViews(env, videoId(mix.youtubeVideoUrl) ?? videoId(mix.externalUrl)).catch(() => null)]);
  const youtube = await keepMax(env, slug, mix, "youtubeViewsMax", observedYoutube);
  // Only the editor's published baseline is trusted. Browser samples are ignored.
  const baseline = Math.max(0, Number(mix.listenCount) || 0);
  return Response.json({ mix: slug, baseline, web, youtube, total: baseline + web + youtube }, { headers });
}
