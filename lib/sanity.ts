import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

/**
 * True when the editorial backend is wired up for this deployment.
 * Read and the reader fall back to their designed empty states when it is not.
 */
export const hasEditorialSource = projectId.length > 0;

/**
 * A client shaped like the Sanity one that always answers with nothing.
 *
 * createClient throws when projectId is empty, and that throw used to happen
 * while the module was being evaluated, which took down the server render of
 * every editorial page. Returning an empty result instead keeps the pages
 * rendering and lets the empty states do their job.
 */
const offlineClient = {
  fetch: async () => [] as never[]
} as unknown as SanityClient;

export const sanityClient: SanityClient = hasEditorialSource
  ? createClient({ projectId, dataset, apiVersion: "2026-08-24", useCdn: true, perspective: "published" })
  : offlineClient;

export const storiesQuery = `*[_type == "editorialStory" && defined(publishedAt)] | order(publishedAt desc) {
  "slug": slug.current,
  "type": coalesce(format, "Editorial"),
  title,
  deck,
  "byline": coalesce(authors[0]->name, byline, "Lowkal"),
  "imageUrl": coverImage.asset->url,
  "imageAlt": coalesce(coverImage.alt, title),
  publishedAt,
  accent,
  body[]{..., _type == "image" => { ..., "asset": asset-> }}
}`;
