import type { Metadata } from "next";
import { SoundroomCatalog } from "@/components/SoundroomCatalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal Archive"
};

export default function ArchivePage() {
  return (
    <main id="main-content" className="soundroom-page" tabIndex={-1}>
      <SoundroomCatalog />
    </main>
  );
}
