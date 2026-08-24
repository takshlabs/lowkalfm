const MAX_BODY_BYTES = 120_000;
const allowedOrigins = new Set(["https://lowkalfm.vercel.app", "http://localhost:3001", "http://127.0.0.1:3001"]);

type EditorialPost = {
  id: string;
  slug: string;
  title: string;
  deck: string;
  body_markdown: string;
  byline: string;
  type: string;
  image_url: string | null;
  image_alt: string | null;
  tone: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function originIsAllowed(origin: string | null) {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === "lowkalfm.vercel.app" || host.endsWith("-takshlabs-projects.vercel.app");
  } catch {
    return false;
  }
}

function headers(request: Request, cacheControl = "no-store") {
  const origin = request.headers.get("origin");
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": cacheControl,
    ...(originIsAllowed(origin) ? { "access-control-allow-origin": origin!, "access-control-allow-headers": "content-type, x-lowkal-editor-session", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS", "access-control-allow-credentials": "true", vary: "Origin" } : {}),
  };
}

function response(request: Request, body: unknown, status = 200, cacheControl?: string) {
  return new Response(JSON.stringify(body), { status, headers: headers(request, cacheControl) });
}

function secretKey() {
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  return keys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function databaseHeaders(extra: Record<string, string> = {}) {
  const key = secretKey();
  return { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { authorization: `Bearer ${key}` }), ...extra };
}

async function database(path: string, init: RequestInit = {}) {
  return fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { ...databaseHeaders(), ...(init.headers ?? {}) },
  });
}

function base64url(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64url(String.fromCharCode(...new Uint8Array(bytes)));
}

function equal(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function editorSession(request: Request) {
  const token = request.headers.get("x-lowkal-editor-session");
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !equal(await sign(payload), signature)) return false;
  try {
    return JSON.parse(decodeBase64url(payload)).exp > Date.now();
  } catch {
    return false;
  }
}

async function readJson<T>(request: Request): Promise<T | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  try { return await request.json() as T; } catch { return null; }
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function body(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100_000) : "";
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function imageUrl(value: unknown) {
  const candidate = text(value, 2_000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function normalizePost(input: Record<string, unknown>) {
  const title = text(input.title, 140);
  const deck = text(input.deck, 360);
  const postBody = body(input.body_markdown);
  const byline = text(input.byline, 100);
  const postSlug = slug(text(input.slug, 100) || title);
  if (!title || !deck || !postBody || !byline || !postSlug) return null;
  const tone = text(input.tone, 20);
  return {
    title, deck, body_markdown: postBody, byline, slug: postSlug,
    type: text(input.type, 60) || "Editorial",
    tone: ["paper", "red", "signal", "ink"].includes(tone) ? tone : "paper",
    status: input.status === "published" ? "published" : "draft",
    image_url: imageUrl(input.image_url), image_alt: text(input.image_alt, 240) || null,
  };
}

async function route(request: Request) {
  const url = new URL(request.url);
  const marker = "/lowkal-editorial/";
  const path = url.pathname.includes(marker) ? url.pathname.split(marker)[1] : "";

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (path === "content/read" && request.method === "GET") {
    const result = await database("editorial_posts?select=id,slug,title,deck,body_markdown,byline,type,image_url,image_alt,tone,status,published_at,created_at,updated_at&status=eq.published&order=published_at.desc,updated_at.desc");
    return response(request, { posts: result.ok ? await result.json() : [], configured: result.ok }, result.ok ? 200 : 503, "public, max-age=60");
  }
  if (path === "content/site-copy" && request.method === "GET") {
    const result = await database("site_copy?select=content_key,value");
    const items = result.ok ? await result.json() as Array<{ content_key: string; value: string }> : [];
    return response(request, { copy: Object.fromEntries(items.map((item) => [item.content_key, item.value])), configured: result.ok }, result.ok ? 200 : 503, "public, max-age=60");
  }
  if (path === "editor/session" && request.method === "POST") {
    if (!originIsAllowed(request.headers.get("origin"))) return response(request, { error: "Invalid origin." }, 403);
    const input = await readJson<{ password?: unknown }>(request);
    const config = await database("lowkal_editor_config?select=secret_hash&singleton=eq.true");
    const [settings] = config.ok ? await config.json() as Array<{ secret_hash: string }> : [];
    if (!input || !settings || !equal(await digest(text(input.password, 512)), settings.secret_hash)) return response(request, { error: "That password did not work." }, 401);
    const payload = base64url(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 8 }));
    return response(request, { token: `${payload}.${await sign(payload)}` });
  }
  if (!path.startsWith("editor/") || !originIsAllowed(request.headers.get("origin")) || !(await editorSession(request))) return response(request, { error: "Editor session required." }, 401);
  if (path === "editor/posts" && request.method === "GET") {
    const result = await database("editorial_posts?select=id,slug,title,status,updated_at&order=updated_at.desc");
    return response(request, { posts: result.ok ? await result.json() : [] }, result.ok ? 200 : 503);
  }
  if (path === "editor/posts" && request.method === "POST") {
    const input = await readJson<Record<string, unknown>>(request);
    const post = input ? normalizePost(input) : null;
    if (!post) return response(request, { error: "Title, deck, story, byline, and a usable slug are required." }, 422);
    const now = new Date().toISOString();
    const saved: EditorialPost = { id: crypto.randomUUID(), ...post, published_at: post.status === "published" ? now : null, created_at: now, updated_at: now };
    const result = await database("editorial_posts", { method: "POST", headers: { "content-type": "application/json", prefer: "return=representation" }, body: JSON.stringify(saved) });
    if (!result.ok) return response(request, { error: result.status === 409 ? "That slug is already in use. Choose another one." : "Could not save that piece." }, result.status === 409 ? 409 : 503);
    return response(request, { ok: true, id: saved.id, slug: saved.slug, status: saved.status }, 201);
  }
  if (path === "editor/site-copy" && request.method === "GET") {
    const result = await database("site_copy?select=content_key,value,updated_at&order=content_key.asc");
    return response(request, { items: result.ok ? await result.json() : [] }, result.ok ? 200 : 503);
  }
  if (path === "editor/site-copy" && request.method === "POST") {
    const input = await readJson<{ key?: unknown; value?: unknown }>(request);
    const key = text(input?.key, 80).replace(/[^a-z0-9._-]/gi, "");
    const value = text(input?.value, 2_000);
    if (!key || !value) return response(request, { error: "A content key and value are required." }, 422);
    const updated_at = new Date().toISOString();
    const result = await database("site_copy?on_conflict=content_key", { method: "POST", headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ content_key: key, value, updated_at }) });
    return result.ok ? response(request, { ok: true, key, value, updated_at }) : response(request, { error: "Could not save that copy." }, 503);
  }
  return response(request, { error: "Not found." }, 404);
}

Deno.serve(async (request) => {
  try { return await route(request); }
  catch { return response(request, { error: "The publishing service is unavailable." }, 503); }
});
