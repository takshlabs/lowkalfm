import { cache } from "react";
import { soundRecords } from "@/lib/content";
import { getSharedMix, sanityImageUrl } from "@/lib/sanity";

export type SharedMixView = {
  slug: string;
  title: string;
  series: string;
  artist: string;
  description: string;
  imageUrl: string;
};

export const resolveSharedMix = cache(async (slug: string): Promise<SharedMixView | null> => {
  const fallback = soundRecords.find((mix) => mix.slug === slug);
  let mix = null;

  try {
    mix = await getSharedMix(slug);
  } catch {
    // Keep local catalogue share pages available during a CMS outage.
  }

  if (!mix && !fallback) return null;

  const title = mix?.title ?? fallback?.title ?? "Lowkal mix";
  const series = mix?.series ?? fallback?.series ?? "Lowkal.fm";
  const artist = mix?.artistDisplayName
    ?? mix?.artists?.map((item) => item.name).filter(Boolean).join(" · ")
    ?? fallback?.artist
    ?? "Lowkal";

  return {
    slug,
    title,
    series,
    artist,
    description: mix?.description ?? fallback?.description ?? `Listen to ${title} by ${artist} on Lowkal.fm.`,
    imageUrl: sanityImageUrl(mix?.thumbnail ?? mix?.artwork ?? fallback?.artwork ?? "/lowkal-logo.jpg", 1600)
  };
});
