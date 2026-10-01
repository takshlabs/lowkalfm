import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sortMixesByLatest, sortMixesForPlacement } from "../lib/listen-order.ts";

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

test("home, soundroom, and archive use CMS order with a date tie break", async () => {
  const query = await source("lib/sanity.ts");
  const provider = await source("components/ListenContentProvider.tsx");
  const home = await source("components/HomeTransmissionDeck.tsx");
  const archive = await source("components/SoundroomCatalog.tsx");
  const soundroom = await source("components/SoundroomFrame.tsx");

  assert.match(query, /order\(releaseDate desc\)/);
  assert.doesNotMatch(query, /playerOrder asc/);
  assert.match(provider, /sortMixesByLatest/);
  assert.match(home, /homeOrder/);
  assert.match(archive, /archiveOrder/);
  assert.match(soundroom, /soundroomOrder/);
});

test("placement order takes priority and equal positions use release date", () => {
  const records = [{ slug: "old", dateISO: "2026-01-01", homeOrder: 1 }, { slug: "new", dateISO: "2026-09-01", homeOrder: 100 }, { slug: "middle", dateISO: "2026-06-01" }];
  assert.deepEqual(sortMixesForPlacement(records, "homeOrder").map(record => record.slug), ["old", "new", "middle"]);
});
