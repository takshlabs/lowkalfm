import { HomeProgrammeIndex } from "@/components/HomeProgrammeIndex";
import { HomeSessionShelf } from "@/components/HomeSessionShelf";
import { HomeStage } from "@/components/HomeStage";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="home-shell home-reimagined">
      <HomeStage />
      <nav className="home-programme-rail" aria-label="Lowkal programme shortcuts">
        <a href="#programmes"><span>002</span><strong>Garden City Gallivanting</strong><small>05 Jul 2026</small></a>
        <a href="#programmes"><span>001</span><strong>Redline</strong><small>13 Apr 2026</small></a>
        <SiteLink href={sitePath("/listen/archive")}><span>AR</span><strong>Archive Room</strong><small>All records ↗</small></SiteLink>
      </nav>
      <HomeSessionShelf />
      <HomeProgrammeIndex />
      <section className="home-gathering" aria-labelledby="home-gathering-title">
        <MediaFrame
          variant="editorial"
          frameClassName="home-gathering-art"
          src={sitePath("/lowkal-logo.jpg")}
          alt="Lowkal illustrated mark"
          fill
          sizes="(max-width: 760px) 100vw, 48vw"
        />
        <div className="home-gathering-copy">
          <span>Stay close</span>
          <h2 id="home-gathering-title">Who played. Where it happened. What comes next.</h2>
          <p>Lowkal programmes start with the people in the room. Follow new sessions, programme notes, and gathering announcements.</p>
          <div>
            <a href="https://www.instagram.com/lowkal.fm/" target="_blank" rel="noreferrer">Instagram ↗</a>
            <a href="https://www.youtube.com/@takezodj" target="_blank" rel="noreferrer">YouTube ↗</a>
          </div>
        </div>
      </section>
    </main>
  );
}
