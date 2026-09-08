import type { Metadata } from "next";
import { ArtistsDirectory } from "@/components/ArtistsDirectory";

export const metadata: Metadata = {
  title: "Artists",
  description: "Lowkal residents, guests, and collaborators."
};

type ArtistsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function ArtistsPage({ params }: ArtistsPageProps) {
  const { slug = [] } = await params;
  return <ArtistsDirectory artistSlug={slug[0] ?? ""} />;
}
