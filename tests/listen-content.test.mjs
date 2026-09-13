import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mapSanityMix, resolveListenCatalogue } from "../lib/listen-content.ts";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("a Sanity mix maps to a public record and keeps Cloudflare audio exclusive", () => {
  const record = mapSanityMix({
    slug: "garden",
    format: "fullSession",
    series: "Lowkal 002",
    title: "Full session",
    artistDisplayName: "Samgod · Sinhatra · Takezo",
    artists: [{ name: "Samgod", slug: "samgod" }],
    releaseDate: "2026-07-05",
    duration: 9366,
    audioDeliveryUrl: "https://audio.example/garden.wav",
    youtubeUrl: "https://www.youtube.com/watch?v=NZETtyc9MFo",
    artwork: "https://cdn.example/garden.jpg",
    genres: ["Multi-genre"],
    tracks: [{ time: 0, title: "Open", artist: "Lowkal" }],
  });

  assert.equal(record?.slug, "garden");
  assert.equal(record?.format, "live-set");
  assert.deepEqual(record?.playback, { provider: "cloudflare", url: "https://audio.example/garden.wav" });
  assert.equal(record?.showInArchive, true);
});

test("an empty or missing Sanity catalogue stays empty", () => {
  assert.deepEqual(resolveListenCatalogue(null).records, []);
  assert.deepEqual(resolveListenCatalogue({}).records, []);
  assert.deepEqual(resolveListenCatalogue({ mixes: [], programmes: [], artists: [] }).artists, []);
});

test("published Sanity mixes become the only public listen catalogue", () => {
  const catalogue = resolveListenCatalogue({
    mixes: [{
      slug: "vol-01",
      format: "volume",
      series: "Vol. 01",
      title: "Redline 006",
      artists: [{ name: "Takezo", slug: "takezo" }],
      releaseDate: "2026-04-13",
      artwork: "https://cdn.example/vol.jpg",
      audioDeliveryUrl: "https://audio.example/vol.wav",
    }],
    programmes: [{ slug: "p1", number: "001", name: "Redline", label: "Lowkal 001", dateISO: "2026-04-13", description: "Live" }],
    artists: [{ slug: "takezo", name: "Takezo", relationship: "resident", location: "Bengaluru", genres: [], shortBio: "", bio: [], links: [], externalMixes: [], productions: [], fieldNotes: [] }],
  });

  assert.equal(catalogue.records.length, 1);
  assert.equal(catalogue.records[0].artist, "Takezo");
  assert.equal(catalogue.programmes[0].name, "Redline");
  assert.equal(catalogue.getArtist("takezo")?.name, "Takezo");
});

test("the listen provider does not restore the local demo catalogue", async () => {
  const provider = await source("components/ListenContentProvider.tsx");
  assert.match(provider, /resolveListenCatalogue/);
  assert.doesNotMatch(provider, /soundRecords/);
  assert.doesNotMatch(provider, /livePrograms/);
  assert.doesNotMatch(provider, /artistProfiles/);
});
