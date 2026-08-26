import type { Metadata } from "next";
import { SoundroomCatalog } from "@/components/SoundroomCatalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal Archive",
  description: "Browse Lowkal programmes, resident volumes, and guest mixes in the Lowkal Archive Room."
};

export default function ArchivePage() {
  return (
    <main id="main">
      <SoundroomCatalog />
    </main>
  );
}
