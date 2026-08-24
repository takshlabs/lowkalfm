import type { Metadata } from "next";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lowkal Soundroom",
  description: "The original Lowkal.fm listening room and archive player."
};

export default function ListenPage() {
  return (
    <main style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#070711" }}>
      <iframe
        src={sitePath("/soundroom/index.html")}
        title="Lowkal Soundroom"
        style={{ display: "block", width: "100%", height: "100%", border: 0 }}
      />
    </main>
  );
}
