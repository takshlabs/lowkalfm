import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the worker exposes a D1-backed editorial and site-copy API behind an editor session", async () => {
  const worker = await source("worker/index.ts");

  for (const route of ["/api/content/read", "/api/content/site-copy", "/api/editor/session", "/api/editor/posts", "/api/editor/site-copy"]) {
    assert.match(worker, new RegExp(route.replaceAll("/", "\\/")));
  }

  assert.match(worker, /LOWKAL_EDITOR_SECRET/);
  assert.match(worker, /HttpOnly/);
  assert.match(worker, /SameSite=Strict/);
  assert.match(worker, /INSERT INTO editorial_posts/);
  assert.match(worker, /INSERT INTO site_copy/);
  assert.match(worker, /status = 'published'/);
});

test("Studio offers editorial and site-copy controls without entering public navigation", async () => {
  const studio = await source("app/studio/page.tsx");
  const header = await source("components/SiteHeader.tsx");

  assert.match(studio, /Editorials/);
  assert.match(studio, /Site copy/);
  assert.doesNotMatch(header, /Studio/);
});
