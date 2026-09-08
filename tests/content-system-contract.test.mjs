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

test("parked mixes stay in the CMS but are not sent to public listen surfaces", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");

  assert.match(schema, /name:\s*"parked"/);
  assert.match(schema, /Park this mix/);
  assert.match(query, /_type == "mix" && published == true && parked != true/);
});

test("published non-parked mixes appear on archive, soundroom, home, and the player", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");
  const provider = await source("components/ListenContentProvider.tsx");
  const archive = await source("components/SoundroomCatalog.tsx");
  const soundroom = await source("components/SoundroomFrame.tsx");
  const home = await source("components/HomeTransmissionDeck.tsx");
  const player = await source("components/AudioProvider.tsx");

  assert.match(query, /_type == "mix" && published == true && parked != true/);
  assert.match(schema, /Hide this published mix from all public Lowkal listen surfaces/);
  assert.match(provider, /showInPlayer:\s*true/);
  assert.match(provider, /showInSoundroom:\s*true/);
  assert.match(provider, /showInArchive:\s*true/);
  assert.match(provider, /showOnHome:\s*true/);
  assert.doesNotMatch(archive, /showInArchive/);
  assert.doesNotMatch(soundroom, /showInSoundroom/);
  assert.doesNotMatch(home, /showOnHome/);
  assert.doesNotMatch(player, /showInPlayer &&/);
});

test("private desk links are managed in Sanity and stay off public navigation", async () => {
  const schema = await source("sanity/schemaTypes/linkBoardType.ts");
  const index = await source("sanity/schemaTypes/index.ts");
  const studio = await source("sanity.config.ts");
  const query = await source("lib/sanity.ts");
  const header = await source("components/SiteHeader.tsx");
  const footer = await source("components/SiteFooter.tsx");
  const player = await source("components/PersistentPlayer.tsx");
  const page = await source("app/desk/page.tsx");
  const desk = await source("components/LinkDesk.tsx");
  const filter = await source("lib/link-board.ts");

  assert.match(index, /linkBoardType/);
  assert.match(studio, /Private links/);
  assert.match(studio, /documentId\("linkBoard"\)/);
  assert.match(schema, /name:\s*"linkBoard"/);
  assert.match(schema, /Share the \/desk link/);
  assert.match(schema, /name:\s*"parked"/);
  assert.match(schema, /Park this link/);
  assert.match(query, /_id == "linkBoard" && published == true/);
  assert.match(query, /links\[parked != true\]/);
  assert.match(page, /robots/);
  assert.match(page, /index:\s*false/);
  assert.match(desk, /target="_blank"/);
  assert.match(filter, /function isAllowedDeskUrl/);
  assert.match(filter, /deskPreviewSources/);
  assert.match(filter, /i\.ytimg\.com/);
  assert.match(desk, /DeskPreview/);
  assert.match(filter, /lowkalfm\.in/);
  assert.doesNotMatch(header, /\/desk/);
  assert.doesNotMatch(footer, /\/desk/);
  assert.match(header, /isUnlistedPath/);
  assert.match(footer, /isUnlistedPath/);
  assert.match(player, /isUnlistedPath/);
  assert.doesNotMatch(desk, /SiteLink/);
});

test("mix masters upload in Sanity and are delivered from the audio CDN", async () => {
  const schema = await source("sanity/schemaTypes/mixType.ts");
  const query = await source("lib/sanity.ts");
  const worker = await source("workers/audio-sync.ts");

  assert.match(schema, /name:\s*"audio"/);
  assert.match(schema, /name:\s*"master"/);
  assert.match(schema, /audio\/wav/);
  assert.match(schema, /name:\s*"startOffset"/);
  assert.match(schema, /Start playback at/);
  assert.match(schema, /MixDurationInput/);
  assert.match(schema, /Taken from the uploaded audio master/);
  assert.doesNotMatch(schema, /rule\.required\(\)\.integer\(\)\.positive\(\)/);
  assert.match(query, /audioDeliveryUrl/);
  assert.match(query, /audioStartOffset/);
  assert.match(worker, /sanity-webhook-signature/);
  assert.match(worker, /\/sanity\/audio-sync/);
  assert.match(worker, /\/audio\//);
  assert.match(worker, /Accept-Ranges/);
  assert.match(worker, /AUDIO_PUBLIC_BASE_URL/);
  assert.match(worker, /sourceAssetId/);
  assert.match(worker, /payload\.audioMasterId \|\| sourceAssetId\(payload\.audioMasterUrl\)/);
  assert.match(worker, /durationSecondsFromWav/);
  assert.match(worker, /set\.duration/);

  const publishingGuide = await source("docs/deployment.md");
  assert.match(publishingGuide, /audio\.master\.asset\._ref/);
  assert.doesNotMatch(publishingGuide, /audio\.master\.asset->_ref/);
});
