import type { Metadata } from "next";
import { SoundroomCatalog } from "@/components/SoundroomCatalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal Archive",
  description: "Browse Lowkal broadcasts, resident volumes and guest mixes inside the three-dimensional archive room."
};

export default function ArchivePage() {
  return (
    <main className="soundroom-page">
      <SoundroomCatalog />
    </main>
  );
}
