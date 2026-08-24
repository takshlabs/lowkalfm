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
