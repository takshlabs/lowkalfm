import type { Metadata } from "next";
import { ReadSurface } from "@/components/ReadSurface";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Read"
};

export function generateStaticParams() {
  return [{ slug: [] }];
}

export default function ReadPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <ReadSurface />
    </main>
  );
}
