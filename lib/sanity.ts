import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const isSanityConfigured = projectId.length > 0;

export const sanityClient = createClient({
  projectId: projectId || "placeholder",
  dataset,
  apiVersion: "2026-08-24",
  useCdn: true,
  perspective: "published"
});

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

export const listenContentQuery = `{
  "mixes": *[_type == "mix" && published == true] | order(playerOrder asc, releaseDate desc) {
    "slug": slug.current,
    format,
    series,
    title,
    artistDisplayName,
    "artists": artists[]->{name, "slug": slug.current},
    releaseDate,
    duration,
    "audioMasterUrl": audio.master.asset->url,
    "audioMasterFilename": audio.master.asset->originalFilename,
    "audioDeliveryUrl": audio.deliveryUrl,
    "artwork": coalesce(artwork.asset->url, thumbnail.asset->url),
    genres,
    description,
    shaderMoodPrompt,
    featured,
    archiveSection,
    showInPlayer,
    showInSoundroom,
    showInArchive,
    showOnHome,
    tracks[]{time, title, artist},
    "programmeSlug": *[_type == "programme" && references(^._id)][0].slug.current
  },
  "programmes": *[_type == "programme" && published == true] | order(sortOrder asc, date desc) {
    "slug": slug.current,
    number,
    name,
    label,
    "dateISO": date,
    description,
    "featuredSetSlug": featuredMix->slug.current,
    "setSlugs": mixes[]->slug.current
  },
  "artists": *[_type == "artist" && published == true] | order(sortOrder asc, name asc) {
    "slug": slug.current,
    name,
    relationship,
    location,
    genres,
    shortBio,
    bio,
    "portrait": portrait.asset->url,
    "coverImage": coverImage.asset->url,
    links[]{label, url},
    "featuredMixSlug": featuredMix->slug.current,
    externalMixes[]{title, platform, url, note, "artwork": artwork.asset->url},
    productions[]{title, releaseType, year, spotifyUrl, externalUrl, "artwork": artwork.asset->url},
    fieldNotes[]{placeName, area, note, tags, mapUrl, "goOutSlug": goOutSlug.current}
  }
}`;
