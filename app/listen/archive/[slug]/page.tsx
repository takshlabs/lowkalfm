import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoundroomCatalog } from "@/components/SoundroomCatalog";
import { soundRecords } from "@/lib/content";
import { getSharedMixSlugs } from "@/lib/sanity";
import { resolveSharedMix } from "@/lib/shared-mix";

type MixPageProps = { params: Promise<{ slug: string }> };

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
  const mix = await resolveSharedMix(slug);
  if (!mix) return { title: "Mix not found", robots: { index: false, follow: false } };

  const canonical = `/listen/archive/${encodeURIComponent(slug)}`;
  const socialImage = mix.imageUrl;
  const pageTitle = `${mix.series} — ${mix.title}`;

  return {
    title: pageTitle,
    description: mix.description,
    alternates: { canonical },
    openGraph: {
      type: "music.song",
      url: canonical,
      siteName: "Lowkal.fm",
      title: pageTitle,
      description: mix.description,
      images: [{ url: socialImage, width: 1200, height: 630, alt: `${mix.title} by ${mix.artist}` }]
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: mix.description,
      images: [{ url: socialImage, alt: `${mix.title} by ${mix.artist}` }]
    }
  };
}

export default async function SharedMixPage({ params }: MixPageProps) {
  const slug = cleanSlug((await params).slug);
  if (!await resolveSharedMix(slug)) notFound();
  return (
    <main id="main-content" className="soundroom-page" tabIndex={-1}>
      <SoundroomCatalog initialMixSlug={slug} autoplay />
    </main>
  );
}
