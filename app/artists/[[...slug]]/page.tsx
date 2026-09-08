import type { Metadata } from "next";
import { ArtistsDirectory } from "@/components/ArtistsDirectory";

export const metadata: Metadata = {
  title: "Artists"
};

export function generateStaticParams() {
  return [{ slug: [] }];
}

export default function ArtistsPage() {
  return <ArtistsDirectory />;
}
