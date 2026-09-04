import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Read uses Sanity as the public editorial source", async () => {
  const client = await source("lib/sanity.ts");
  const feed = await source("components/ReadFeed.tsx");
  const article = await source("components/ReadArticle.tsx");

  assert.match(client, /createClient/);
  assert.match(client, /NEXT_PUBLIC_SANITY_PROJECT_ID/);
  assert.match(client, /editorialStory/);
  assert.match(feed, /sanityClient\.fetch/);
  assert.match(article, /PortableText/);
  assert.doesNotMatch(feed, /editorial-api/);
  assert.doesNotMatch(article, /editorial-api/);
});

test("Studio embeds Sanity and supports flexible editorial fields", async () => {
  const studio = await source("components/SanityStudio.tsx");
  const schema = await source("sanity/schemaTypes/editorialStoryType.ts");
  const header = await source("components/SiteHeader.tsx");

  assert.match(studio, /Studio/);
  assert.match(schema, /Flexible details/);
  assert.match(schema, /audioEmbed/);
  assert.match(schema, /pullQuote/);
  assert.doesNotMatch(header, /Studio/);
});

test("Listen artist profiles are managed in Sanity", async () => {
  const schema = await source("sanity/schemaTypes/artistType.ts");
  const query = await source("lib/sanity.ts");
  const profile = await source("components/ArtistsDirectory.tsx");

  assert.match(schema, /Keep the artist bio to 200 words or fewer/);
  assert.match(schema, /featuredMix/);
  assert.match(schema, /externalMixes/);
  assert.match(schema, /productions/);
  assert.match(schema, /fieldNotes/);
  assert.match(query, /featuredMixSlug/);
  assert.match(query, /goOutSlug/);
  assert.match(profile, /ArtistFocusPlayer/);
  assert.match(profile, /open\.spotify\.com\/embed/);
  assert.match(profile, /Open in Go Out/);
});

test("mix masters upload in Sanity and are delivered from the audio CDN", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");
  const worker = await source("workers/audio-sync.ts");

  assert.match(schema, /name:\s*"audio"/);
  assert.match(schema, /name:\s*"master"/);
  assert.match(schema, /audio\/wav/);
  assert.match(query, /audioDeliveryUrl/);
  assert.match(worker, /sanity-webhook-signature/);
  assert.match(worker, /\/sanity\/audio-sync/);
  assert.match(worker, /\/audio\//);
  assert.match(worker, /Accept-Ranges/);
  assert.match(worker, /AUDIO_PUBLIC_BASE_URL/);
  assert.match(worker, /sourceAssetId/);
  assert.match(worker, /payload\.audioMasterId \|\| sourceAssetId\(payload\.audioMasterUrl\)/);

  const publishingGuide = await source("docs/deployment.md");
  assert.match(publishingGuide, /audio\.master\.asset\._ref/);
  assert.doesNotMatch(publishingGuide, /audio\.master\.asset->_ref/);
});
