import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { collectGoOutPins, coordinatesFromFieldNote } from "../lib/go-out-map.ts";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const takezo = {
  slug: "takezo",
  name: "Takezo",
  relationship: "resident",
  location: "Bengaluru",
  genres: [],
  shortBio: "",
  bio: [],
  links: [],
  externalMixes: [],
  productions: [],
  fieldNotes: [
    {
      placeName: "Hungry Hippie",
      area: "Koramangala",
      note: "Late bass, long walks after.",
      tags: ["bar"],
      latitude: 12.9345,
      longitude: 77.626,
      goOutSlug: "hungry-hippie",
    },
    {
      placeName: "Missing coords",
      area: "Indiranagar",
      note: "No pin yet.",
      tags: [],
    },
    {
      placeName: "Toit",
      area: "Indiranagar",
      note: "From a map link.",
      tags: ["brewery"],
      mapUrl: "https://www.google.com/maps/@12.9781,77.6408,17z",
    },
  ],
};

test("field notes with coordinates or a map URL become Go out pins", () => {
  assert.deepEqual(coordinatesFromFieldNote(takezo.fieldNotes[0]), { lat: 12.9345, lng: 77.626 });
  assert.equal(coordinatesFromFieldNote(takezo.fieldNotes[1]), null);
  assert.deepEqual(coordinatesFromFieldNote(takezo.fieldNotes[2]), { lat: 12.9781, lng: 77.6408 });

  const pins = collectGoOutPins([takezo]);
  assert.equal(pins.length, 2);
  assert.equal(pins[0].id, "hungry-hippie");
  assert.equal(pins[0].artistSlug, "takezo");
  assert.equal(pins[1].placeName, "Toit");
});

test("artist CMS field notes carry map coordinates for Go out", async () => {
  const schema = await source("sanity/schemaTypes/artistType.ts");
  const query = await source("lib/sanity.ts");
  assert.match(schema, /name:\s*"latitude"/);
  assert.match(schema, /name:\s*"longitude"/);
  assert.match(query, /latitude/);
  assert.match(query, /longitude/);
});

test("Go out is a map of artist hangouts and not a construction page", async () => {
  const page = await source("app/go-out/page.tsx");
  const guide = await source("components/GoOutGuide.tsx");
  assert.match(page, /GoOutGuide/);
  assert.doesNotMatch(page, /UnderConstructionNote/);
  assert.doesNotMatch(page, /cityEvents/);
  assert.match(guide, /collectGoOutPins/);
  assert.match(guide, /go-out-map/);
});
