import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sortMixesByLatest } from "../lib/listen-order.ts";

const root = new URL("..", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("listen mixes are ordered by release date, newest first", () => {
  assert.deepEqual(
    sortMixesByLatest([
      { slug: "older", dateISO: "2026-03-19" },
      { slug: "newest", dateISO: "2026-09-08" },
      { slug: "middle", dateISO: "2026-04-13" },
    ]).map((record) => record.slug),
    ["newest", "middle", "older"],
  );
});

test("home, soundroom, and archive use the shared newest-first mix list", async () => {
  const query = await source("lib/sanity.ts");
  const provider = await source("components/ListenContentProvider.tsx");
  const home = await source("components/HomeTransmissionDeck.tsx");
  const archive = await source("components/SoundroomCatalog.tsx");
  const soundroom = await source("components/SoundroomFrame.tsx");

  assert.match(query, /order\(releaseDate desc\)/);
  assert.doesNotMatch(query, /playerOrder asc/);
  assert.match(provider, /sortMixesByLatest/);
  assert.doesNotMatch(home, /homeOrder/);
  assert.doesNotMatch(archive, /archiveOrder/);
  assert.doesNotMatch(soundroom, /soundroomOrder/);
});
