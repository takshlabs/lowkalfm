import type { Metadata } from "next";
import { ArtistsDirectory } from "@/components/ArtistsDirectory";

export const metadata: Metadata = {
  title: "Artists",
  description: "Lowkal residents, guests, and collaborators."
};

export function generateStaticParams() {
  return [{ slug: [] }];
}

export default function ArtistsPage() {
  return <ArtistsDirectory />;
}
