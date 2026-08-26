import type { Metadata } from "next";
import { SoundroomFrame } from "@/components/SoundroomFrame";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal Soundroom",
  description: "The original Lowkal.fm listening room and archive player."
};

export default function ListenPage() {
  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#070711" }}>
      <SoundroomFrame />
    </main>
  );
}
