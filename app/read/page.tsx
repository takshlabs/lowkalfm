import type { Metadata } from "next";
import { ReadFeed } from "@/components/ReadFeed";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Read",
  description: "Artist conversations, field notes, photo essays and reported stories from Lowkal."
};

export default function ReadPage() {
  return (
    <main className="on-paper" id="main">
      <section className="page-hero read-hero">
        <span className="page-hero__ghost" aria-hidden="true">02</span>
        <p className="section-kicker">02 · Read</p>
        <h1 className="page-hero__title">Stories from the <em>room.</em></h1>
        <p className="page-hero__note">
          Artist conversations, field notes, photographs, and programme records from the
          people who make Lowkal.
        </p>
      </section>

      <ReadFeed />

      <section className="editorial-note on-red" aria-labelledby="read-pitch-title">
        <p className="section-kicker">Pitch Lowkal</p>
        <h2 id="read-pitch-title">A good story can begin with one sound.</h2>
        <a className="link-quiet" href="mailto:hello@lowkal.fm?subject=Story%20pitch">
          Send a short pitch ↗
        </a>
      </section>
    </main>
  );
}
