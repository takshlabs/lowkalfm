import type { Metadata } from "next";
import { MediaFrame } from "@/components/MediaFrame";
import { ReadFeed } from "@/components/ReadFeed";
import { journalStories } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Read",
  description: "Artist conversations, field notes, photo essays and reported stories from Lowkal."
};

export default function ReadPage() {
  return (
    <main className="journal-page">
      <section className="section-page-hero read-hero">
        <MediaFrame variant="hero" frameClassName="section-hero-art read-hero-art" src={sitePath("/art/lotus-collage.jpg")} alt="Red collage with lotus flowers and painted eyes" fill sizes="(max-width: 680px) 64vw, 34vw" priority />
        <span className="section-kicker">02 · Read</span>
        <h1>Stories from<br />the <em>room.</em></h1>
        <p>Conversations and field notes from Lowkal.</p>
      </section>
      <ReadFeed fallback={journalStories.map((story, index) => ({
        ...story,
        slug: ["dancefloor-workers", "flyover-rain", "last-bus-home", "sarang-meeting-place"][index] ?? `story-${index + 1}`,
      }))} />
      <section className="journal-note">
        <span className="section-kicker">Pitch Lowkal</span>
        <h2>A good story can begin with one sound.</h2>
        <a href="mailto:hello@lowkal.fm?subject=Story%20pitch">Send a short pitch ↗</a>
      </section>
    </main>
  );
}
