"use client";

import { usePathname } from "next/navigation";
import { MediaFrame } from "@/components/MediaFrame";
import { ReadArticle } from "@/components/ReadArticle";
import { ReadFeed } from "@/components/ReadFeed";
import { sitePath } from "@/lib/site-path";

function readPathSlug(pathname: string) {
  const cleanPath = pathname.replace(/\/$/, "");
  const marker = "/read/";
  const index = cleanPath.indexOf(marker);
  return index >= 0 ? decodeURIComponent(cleanPath.slice(index + marker.length).split("/")[0]) : "";
}

export function ReadSurface() {
  const pathname = usePathname();
  const slug = readPathSlug(pathname);

  if (slug) return <ReadArticle slug={slug} />;

  return (
    <div className="journal-page">
      <section className="section-page-hero read-hero">
        <MediaFrame variant="hero" frameClassName="section-hero-art read-hero-art" src={sitePath("/art/lotus-collage.jpg")} alt="Red collage with lotus flowers and painted eyes" fill sizes="(max-width: 680px) 64vw, 34vw" priority />
        <span className="section-kicker">02 · Read</span>
        <h1>Stories from<br />the <em>room.</em></h1>
        <p>Conversations and field notes from Lowkal.</p>
      </section>
      <ReadFeed />
      <section className="journal-note">
        <span className="section-kicker">Pitch Lowkal</span>
        <h2>A good story can begin with one sound.</h2>
        <a href="mailto:hello@lowkal.fm?subject=Story%20pitch">Send a short pitch ↗</a>
      </section>
    </div>
  );
}
