import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

type D1Result<T> = { results?: T[] };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
};
type D1Database = { prepare(query: string): D1Statement };

interface Env {
  ASSETS: Fetcher;
  CONTENT_DB?: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  LOWKAL_EDITOR_SECRET?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

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

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const PUBLIC_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" };
const MAX_BODY_BYTES = 120_000;

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { ...init, headers: { ...JSON_HEADERS, ...(init.headers ?? {}) } });
}

function publicJson(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { ...init, headers: { ...PUBLIC_HEADERS, ...(init.headers ?? {}) } });
}

function parseCookies(request: Request) {
  return Object.fromEntries((request.headers.get("cookie") ?? "").split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }).filter(([key]) => key));
}

function base64url(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64url(String.fromCharCode(...new Uint8Array(signature)));
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function isEditor(request: Request, env?: Env) {
  const secret = env?.LOWKAL_EDITOR_SECRET;
  const token = parseCookies(request).lowkal_editor;
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if ((await sign(payload, secret)) !== signature) return false;
  try {
    return JSON.parse(fromBase64url(payload)).exp > Date.now();
  } catch {
    return false;
  }
}

async function readJson<T>(request: Request): Promise<T | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return null;
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanBody(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 100_000);
}

function cleanImageUrl(value: unknown) {
  const url = cleanText(value, 2_000);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function normalizePost(input: Record<string, unknown>) {
  const title = cleanText(input.title, 140);
  const deck = cleanText(input.deck, 360);
  const body = cleanBody(input.body_markdown);
  const byline = cleanText(input.byline, 100);
  const type = cleanText(input.type, 60) || "Editorial";
  const tone = ["paper", "red", "signal", "ink"].includes(cleanText(input.tone, 20)) ? cleanText(input.tone, 20) : "paper";
  const status = input.status === "published" ? "published" : "draft";
  const slug = slugify(cleanText(input.slug, 100) || title);
  if (!title || !deck || !body || !byline || !slug) return null;
  return { title, deck, body, byline, type, tone, status, slug, imageUrl: cleanImageUrl(input.image_url), imageAlt: cleanText(input.image_alt, 240) || null };
}

async function contentApi(request: Request, env: Env | undefined, url: URL): Promise<Response | null> {
  const db = env?.CONTENT_DB;
  const path = url.pathname;

  if (path === "/api/content/read" && request.method === "GET") {
    if (!db) return publicJson({ posts: [], configured: false });
    const result = await db.prepare("SELECT id, slug, title, deck, body_markdown, byline, type, image_url, image_alt, tone, status, published_at, created_at, updated_at FROM editorial_posts WHERE status = 'published' ORDER BY published_at DESC, updated_at DESC").all<EditorialPost>();
    return publicJson({ posts: result.results ?? [], configured: true });
  }

  if (path === "/api/content/site-copy" && request.method === "GET") {
    if (!db) return publicJson({ copy: {}, configured: false });
    const result = await db.prepare("SELECT content_key, value FROM site_copy").all<{ content_key: string; value: string }>();
    const copy = Object.fromEntries((result.results ?? []).map((item) => [item.content_key, item.value]));
    return publicJson({ copy, configured: true });
  }

  if (path === "/api/editor/session" && request.method === "POST") {
    const secret = env?.LOWKAL_EDITOR_SECRET;
    if (!sameOrigin(request) || !secret) return json({ error: "Studio is not configured." }, { status: 503 });
    const body = await readJson<{ password?: unknown }>(request);
    if (!body || cleanText(body.password, 512) !== secret) return json({ error: "That password did not work." }, { status: 401 });
    const payload = base64url(JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 8 }));
    const cookie = `lowkal_editor=${payload}.${await sign(payload, secret)}; Path=/api/editor; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
    return json({ ok: true }, { headers: { "set-cookie": cookie } });
  }

  if (path === "/api/editor/session" && request.method === "DELETE") {
    return json({ ok: true }, { headers: { "set-cookie": "lowkal_editor=; Path=/api/editor; HttpOnly; Secure; SameSite=Strict; Max-Age=0" } });
  }

  if (!path.startsWith("/api/editor/")) return null;
  if (!sameOrigin(request) || !(await isEditor(request, env))) return json({ error: "Editor session required." }, { status: 401 });
  if (!db) return json({ error: "Content storage is not configured yet." }, { status: 503 });

  if (path === "/api/editor/posts" && request.method === "GET") {
    const result = await db.prepare("SELECT id, slug, title, deck, body_markdown, byline, type, image_url, image_alt, tone, status, published_at, created_at, updated_at FROM editorial_posts ORDER BY updated_at DESC").all<EditorialPost>();
    return json({ posts: result.results ?? [] });
  }

  if (path === "/api/editor/posts" && request.method === "POST") {
    const body = await readJson<Record<string, unknown>>(request);
    const post = body ? normalizePost(body) : null;
    if (!post) return json({ error: "Title, deck, body, byline, and a usable slug are required." }, { status: 422 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const publishedAt = post.status === "published" ? now : null;
    try {
      await db.prepare("INSERT INTO editorial_posts (id, slug, title, deck, body_markdown, byline, type, image_url, image_alt, tone, status, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, post.slug, post.title, post.deck, post.body, post.byline, post.type, post.imageUrl, post.imageAlt, post.tone, post.status, publishedAt, now, now).run();
      return json({ ok: true, id, slug: post.slug, status: post.status }, { status: 201 });
    } catch {
      return json({ error: "That slug is already in use. Choose another one." }, { status: 409 });
    }
  }

  if (path === "/api/editor/site-copy" && request.method === "GET") {
    const result = await db.prepare("SELECT content_key, value, updated_at FROM site_copy ORDER BY content_key").all<{ content_key: string; value: string; updated_at: string }>();
    return json({ items: result.results ?? [] });
  }

  if (path === "/api/editor/site-copy" && request.method === "POST") {
    const body = await readJson<{ key?: unknown; value?: unknown }>(request);
    const key = cleanText(body?.key, 80).replace(/[^a-z0-9._-]/gi, "");
    const value = cleanText(body?.value, 2_000);
    if (!key || !value) return json({ error: "A content key and value are required." }, { status: 422 });
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO site_copy (content_key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(content_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(key, value, now).run();
    return json({ ok: true, key, value, updated_at: now });
  }

  return json({ error: "Not found." }, { status: 404 });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const response = await contentApi(request, env, url);
      if (response) return response;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
            return result.response();
          }
        },
        allowedWidths
      );
    }

    return handler.fetch(request, env, ctx);
  }
};

export default worker;
