import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("each mix route publishes complete social metadata", async () => {
  const page = await source("app/listen/archive/[slug]/page.tsx");

  assert.match(page, /title: pageTitle/);
  assert.match(page, /description: mix\.description/);
  assert.match(page, /type: "music\.song"/);
  assert.match(page, /card: "summary_large_image"/);
  assert.match(page, /socialImage/);
  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /<SoundroomCatalog initialMixSlug=\{slug\} autoplay/);
});

test("the social image uses the mix thumbnail with a vignette and identity", async () => {
  const image = await source("scripts/generate-mix-social-images.mjs");

  assert.match(image, /width: 1200, height: 630/);
  assert.match(image, /thumbnail\.asset->url/);
  assert.match(image, /linear-gradient/);
  assert.match(image, /boxShadow: "inset/);
  assert.match(image, /LOWKAL\.FM/);
  assert.match(image, /mix\.slug/);
  assert.match(image, /fontSize: 29[\s\S]*artist/);
});

test("mix selection replaces the address with the stable share route", async () => {
  const catalog = await source("components/SoundroomCatalog.tsx");

  assert.match(catalog, /`\/listen\/archive\/\$\{encodeURIComponent\(slug\)\}`/);
  assert.match(catalog, /window\.history\.replaceState\(null, "", mixPath\(slug\)\)/);
});
