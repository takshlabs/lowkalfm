import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const sanityClient = createClient({ projectId, dataset, apiVersion: "2026-08-24", useCdn: true, perspective: "published" });

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
