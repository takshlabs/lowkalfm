import { ImageResponse } from "@vercel/og";
import { createElement } from "react";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const siteRoot = "dist/client";
const archiveRoot = join(siteRoot, "listen/archive");
const outputRoot = join(siteRoot, "social/mixes");
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-08-24";
const fallbackMixes = [
  { slug: "lowkal-002-garden-city-gallivanting", title: "Full session", series: "Lowkal 002 | Garden City Gallivanting", artist: "Samgod · Sinhatra · Takezo", image: "/lowkal-002.jpg" },
  { slug: "lowkal-fm-vol-01", title: "Redline 006", series: "Lowkal.fm Vol. 01", artist: "Takezo", image: "/kinetic-drift.png" },
  { slug: "lowkal-fm-vol-02", title: "Meeting Point", series: "Lowkal.fm Vol. 02", artist: "sa:rang", image: "/meeting-point.png" },
  { slug: "lowkal-001-takezo", title: "Featured set", series: "Lowkal 001 | Redline", artist: "Takezo", image: "/kinetic-drift.png" },
  { slug: "lowkal-001-sarang", title: "Live set", series: "Lowkal 001 | Redline", artist: "sa:rang", image: "/meeting-point.png" }
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function textFromHtml(value = "") {
  return decodeHtml(value.replace(/<!--.*?-->/gs, "").replace(/<[^>]+>/g, "")).trim();
}

function imageMime(path) {
  const extension = extname(new URL(path, "https://lowkalfm.in").pathname).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function embeddedImage(source) {
  try {
    if (source.startsWith("/")) {
      const bytes = await readFile(join(siteRoot, source));
      return `data:${imageMime(source)};base64,${bytes.toString("base64")}`;
    }
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${response.headers.get("content-type") ?? imageMime(source)};base64,${bytes.toString("base64")}`;
  } catch {
    const bytes = await readFile(join(siteRoot, "lowkal-logo.jpg"));
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  }
}

async function cmsMixes() {
  if (!projectId) return [];
  const query = `*[_type == "mix" && published == true && parked != true && defined(slug.current)]{
    "slug": slug.current,
    title,
    series,
    "artist": coalesce(artistDisplayName, array::join(artists[]->name, " · "), "Lowkal"),
    "image": coalesce(thumbnail.asset->url, artwork.asset->url)
  }`;
  const url = new URL(`/v${apiVersion}/data/query/${encodeURIComponent(dataset)}`, `https://${projectId}.apicdn.sanity.io`);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity mix request failed with ${response.status}`);
  return (await response.json()).result ?? [];
}

async function renderedMixes() {
  let files = [];
  try {
    files = (await readdir(archiveRoot)).filter((file) => file.endsWith(".html") && file !== "index.html");
  } catch {
    return [];
  }
  return Promise.all(files.map(async (file) => {
    const html = await readFile(join(archiveRoot, file), "utf8");
    const selected = html.match(/<button[^>]*class="archive-record is-selected"[^>]*>(.*?)<\/button>/s)?.[1] ?? "";
    const pageTitle = textFromHtml(html.match(/<title>(.*?)<\/title>/s)?.[1]);
    const [series = "Lowkal.fm", title = "Lowkal mix"] = pageTitle.split(" — ", 2);
    return {
      slug: file.slice(0, -5),
      title: textFromHtml(selected.match(/class="archive-record-tab"[^>]*>(.*?)<\/span>/s)?.[1]) || title,
      series,
      artist: textFromHtml(selected.match(/<strong>(.*?)<\/strong>/s)?.[1]) || "Lowkal",
      image: decodeHtml(selected.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? "/lowkal-logo.jpg")
    };
  }));
}

function card({ image, title, series, artist }) {
  const layer = (style) => createElement("div", { style: { position: "absolute", inset: 0, display: "flex", ...style } });
  return createElement("div", {
    style: { position: "relative", display: "flex", width: "100%", height: "100%", overflow: "hidden", color: "#f2eee5", background: "#0e0e0d" }
  },
  createElement("img", { src: image, width: 1200, height: 630, style: { width: "100%", height: "100%", objectFit: "cover" } }),
  layer({ background: "linear-gradient(90deg, rgba(7,7,6,.82) 0%, rgba(7,7,6,.32) 48%, rgba(7,7,6,.18) 72%, rgba(7,7,6,.58) 100%)" }),
  layer({ background: "linear-gradient(0deg, rgba(7,7,6,.78) 0%, transparent 52%, rgba(7,7,6,.28) 100%)", boxShadow: "inset 0 0 110px rgba(0,0,0,.6)" }),
  createElement("div", {
    style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "58px 64px 54px" }
  },
  createElement("div", { style: { display: "flex", fontSize: 25, fontWeight: 700, letterSpacing: 4 } }, "LOWKAL.FM"),
  createElement("div", { style: { display: "flex", flexDirection: "column", maxWidth: 900 } },
    createElement("div", { style: { display: "flex", marginBottom: 14, fontSize: 24, letterSpacing: 2, textTransform: "uppercase", opacity: .82 } }, series),
    createElement("div", { style: { display: "flex", fontSize: 72, fontWeight: 800, lineHeight: .98, letterSpacing: -2 } }, title),
    createElement("div", { style: { display: "flex", marginTop: 20, fontSize: 29, letterSpacing: 1 } }, artist)
  )));
}

const rendered = await renderedMixes();
let cms = [];
try {
  cms = await cmsMixes();
} catch (error) {
  console.warn(`Could not load CMS mix images: ${error instanceof Error ? error.message : error}`);
}
const mixes = new Map(fallbackMixes.map((mix) => [mix.slug, mix]));
for (const mix of rendered) mixes.set(mix.slug, mix);
for (const mix of cms) if (mix.slug) mixes.set(mix.slug, mix);

await mkdir(outputRoot, { recursive: true });
for (const mix of mixes.values()) {
  const image = await embeddedImage(mix.image || "/lowkal-logo.jpg");
  const response = new ImageResponse(card({ ...mix, image }), { width: 1200, height: 630 });
  await writeFile(join(outputRoot, `${mix.slug}.png`), Buffer.from(await response.arrayBuffer()));
}

console.log(`Generated ${mixes.size} mix social image(s).`);
