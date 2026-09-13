import type { Metadata } from "next";
import { GoOutGuide } from "@/components/GoOutGuide";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Go out"
};

export default function GoOutPage() {
  return (
    <main id="main-content" className="city-page" tabIndex={-1}>
      <GoOutGuide />
    </main>
  );
}
