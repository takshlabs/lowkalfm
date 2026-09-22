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

test("the listen count keeps its compact type and measured spacing", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const polish = await readFile(new URL("app/reimagined.css", root), "utf8");

  assert.match(css, /\.transmission-overlay > span \{ margin: 0; font-size: 0\.76rem; \}/);
  assert.doesNotMatch(css, /\.transmission-overlay span \{ margin: 0; font-size: 0\.76rem; \}/);
  assert.match(polish, /\.mix-listen-count \{[^}]*align-items: center;[^}]*gap: 6px;[^}]*line-height: 1\.2;/);
  assert.match(polish, /\.transmission-overlay \.mix-listen-count \{ margin-top: 10px;[^}]*opacity: 0\.6; \}/);
});
