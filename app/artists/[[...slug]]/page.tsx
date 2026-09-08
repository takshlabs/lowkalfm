import type { Metadata } from "next";
import { ArtistsDirectory } from "@/components/ArtistsDirectory";
import { artistProfiles } from "@/lib/content";
import { isSanityConfigured, sanityClient } from "@/lib/sanity";

export const metadata: Metadata = {
  title: "Artists",
  description: "Lowkal residents, guests, and collaborators."
};

type ArtistsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  const fallbackSlugs = artistProfiles.map((artist) => artist.slug);
  if (!isSanityConfigured) return [{ slug: [] }, ...fallbackSlugs.map((slug) => ({ slug: [slug] }))];

  try {
    const artistSlugs = await sanityClient.fetch<string[]>(`*[_type == "artist" && published == true && defined(slug.current)].slug.current`);
    const slugs = [...new Set([...fallbackSlugs, ...artistSlugs])];
    return [{ slug: [] }, ...slugs.map((slug) => ({ slug: [slug] }))];
  } catch {
    return [{ slug: [] }, ...fallbackSlugs.map((slug) => ({ slug: [slug] }))];
  }
}

export default async function ArtistsPage({ params }: ArtistsPageProps) {
  const { slug = [] } = await params;
  return <ArtistsDirectory artistSlug={slug[0] ?? ""} />;
}
