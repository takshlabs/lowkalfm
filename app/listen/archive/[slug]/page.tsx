import type { Metadata } from "next";
import { SoundroomCatalog } from "@/components/SoundroomCatalog";
import { soundRecords } from "@/lib/content";
import { getSharedMix, getSharedMixSlugs, sanityImageUrl } from "@/lib/sanity";

type MixPageProps = { params: Promise<{ slug: string }> };

function getFallbackMix(slug: string) {
  return soundRecords.find((mix) => mix.slug === slug);
}

function cleanSlug(slug: string) {
  return decodeURIComponent(slug).trim();
}

export async function generateStaticParams() {
  // The local catalogue keeps share pages available when the CMS is not
  // configured during a local build. Production adds all published CMS mixes.
  const fallbackSlugs = soundRecords.map((mix) => mix.slug);
  let cmsSlugs: string[] = [];
  try {
    cmsSlugs = await getSharedMixSlugs();
  } catch {
    // A CMS outage must not stop a release of the available local catalogue.
  }
  return [...new Set([...fallbackSlugs, ...cmsSlugs])].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: MixPageProps): Promise<Metadata> {
  const slug = cleanSlug((await params).slug);
  const mix = await getSharedMix(slug);
  const fallback = getFallbackMix(slug);
  const title = mix?.title ?? fallback?.title ?? "Lowkal mix";
  const series = mix?.series ?? fallback?.series ?? "Lowkal.fm";
  const artist = mix?.artistDisplayName ?? mix?.artists?.map((item) => item.name).filter(Boolean).join(" · ") ?? fallback?.artist ?? "Lowkal";
  const description = mix?.description ?? fallback?.description ?? `Listen to ${title} by ${artist} on Lowkal.fm.`;
  // The CMS thumbnail is the social crop. Artwork remains the fallback.
  const image = mix?.thumbnail ?? mix?.artwork ?? fallback?.artwork ?? "/lowkal-logo.jpg";
  const imageUrl = sanityImageUrl(image, 1200);
  const canonical = `/listen/archive/${encodeURIComponent(slug)}`;
  const pageTitle = `${series} — ${title}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      type: "music.song",
      url: canonical,
      siteName: "Lowkal.fm",
      title: pageTitle,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${title} artwork` }]
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [imageUrl]
    }
  };
}

export default async function SharedMixPage({ params }: MixPageProps) {
  const slug = cleanSlug((await params).slug);
  return (
    <main id="main-content" className="soundroom-page" tabIndex={-1}>
      <SoundroomCatalog initialMixSlug={slug} autoplay />
    </main>
  );
}
