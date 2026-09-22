const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-08-24";

export const isSanityConfigured = projectId.length > 0;
export const sanityCdnOrigin = isSanityConfigured ? `https://${projectId}.apicdn.sanity.io` : "";

export function sanityImageUrl(source: string, width = 1200) {
  try {
    const url = new URL(source);
    if (url.hostname !== "cdn.sanity.io" || !url.pathname.startsWith("/images/")) return source;
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "max");
    url.searchParams.set("q", "82");
    url.searchParams.set("w", String(Math.max(64, Math.round(width))));
    return url.toString();
  } catch {
    return source;
  }
}

export async function sanityFetch<Result>(query: string, options: { signal?: AbortSignal } = {}) {
  if (!isSanityConfigured) throw new Error("Sanity is not configured");
  const url = new URL(`/v${apiVersion}/data/query/${encodeURIComponent(dataset)}`, sanityCdnOrigin);
  url.searchParams.set("query", query);
  url.searchParams.set("perspective", "published");
  url.searchParams.set("returnQuery", "false");
  const response = await fetch(url, {
    cache: "default",
    credentials: "omit",
    signal: options.signal
  });
  if (!response.ok) throw new Error(`Sanity request failed with ${response.status}`);
  const payload = await response.json() as { result?: Result };
  if (!("result" in payload)) throw new Error("Sanity returned no result");
  return payload.result as Result;
}

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
  "mixes": *[_type == "mix" && published == true && parked != true] | order(releaseDate desc) {
    "slug": slug.current,
    format,
    series,
    title,
    artistDisplayName,
    "artists": artists[]->{name, "slug": slug.current},
    releaseDate,
    duration,
    listenCount,
    "audioDeliveryUrl": audio.deliveryUrl,
    "audioPeaksUrl": audio.peaksUrl,
    "audioStartOffset": audio.startOffset,
    "youtubeUrl": externalUrl,
    youtubeVideoUrl,
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

export type SharedMix = {
  slug: string;
  title: string;
  series: string;
  artistDisplayName?: string;
  artists?: Array<{ name?: string }>;
  description?: string;
  artwork?: string;
  thumbnail?: string;
};

const sharedMixFields = `{
  "slug": slug.current,
  title,
  series,
  artistDisplayName,
  "artists": artists[]->{name},
  description,
  "artwork": artwork.asset->url,
  "thumbnail": thumbnail.asset->url
}`;

export const sharedMixBySlugQuery = `*[_type == "mix" && published == true && parked != true && slug.current == $slug][0]${sharedMixFields}`;
export const sharedMixSlugsQuery = `*[_type == "mix" && published == true && parked != true && defined(slug.current)].slug.current`;

export async function getSharedMix(slug: string) {
  if (!isSanityConfigured || !slug) return null;
  return sanityFetch<SharedMix | null>(sharedMixBySlugQuery.replace("$slug", JSON.stringify(slug)));
}

export async function getSharedMixSlugs() {
  if (!isSanityConfigured) return [];
  return sanityFetch<string[]>(sharedMixSlugsQuery);
}

export const linkBoardQuery = `*[_id == "linkBoard" && published == true][0]{
  title,
  kicker,
  intro,
  "links": links[parked != true]{
    title,
    url,
    label,
    description,
    "imageUrl": preview.asset->url,
    "imageAlt": coalesce(preview.alt, title)
  }
}`;
