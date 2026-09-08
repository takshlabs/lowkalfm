import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("phone home canvases stay compact with a large corner play control", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const mobile = await readFile(new URL("app/home-transmissions.css", root), "utf8");
  const layout = await readFile(new URL("app/layout.tsx", root), "utf8");

  assert.match(layout, /home-transmissions\.css/);
  assert.match(css, /\.transmission-card \{ flex: 0 0 min\(72vw, 280px\);/);
  assert.doesNotMatch(css, /\.transmission-media,\s*\n\s*\.city-card \{ min-height: 2\d{2}px; \}/);
  assert.match(mobile, /\.transmission-card \{ flex-basis: min\(72vw, 268px\); \}/);
  assert.match(mobile, /\.transmission-media > button \{ width: 56px; height: 56px; \}/);
});
