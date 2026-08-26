import { HomeTransmissionDeck } from "@/components/HomeTransmissionDeck";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="home-shell rinse-home">
      <div className="home-shader" aria-hidden="true" />

      <section className="rinse-hero" aria-labelledby="rinse-hero-title">
        <MediaFrame variant="hero" frameClassName="rinse-hero-frame" src={sitePath("/kinetic-drift.png")} alt="Lowkal Vol. 01 artwork" fill sizes="100vw" priority />
        <div className="rinse-hero-wash" aria-hidden="true" />
        <div className="rinse-hero-copy">
          <span>Lowkal.fm · Bengaluru</span>
          <h1 id="rinse-hero-title">The city has a frequency.</h1>
          <p>Independent radio, field notes, and nights from Bengaluru.</p>
          <SiteLink href={sitePath("/listen")}>Tune in <span aria-hidden="true">▶</span></SiteLink>
        </div>
      </section>

      <nav className="home-channel-row" aria-label="Lowkal channels">
        <SiteLink href={sitePath("/listen")}><span>01</span><strong>Listen</strong><small>Weekly mixes</small></SiteLink>
        <SiteLink href={sitePath("/read")}><span>02</span><strong>Read</strong><small>Field notes</small></SiteLink>
        <SiteLink href={sitePath("/go-out")}><span>03</span><strong>Go out</strong><small>City guide</small></SiteLink>
        <SiteLink href={sitePath("/listen/archive")}><span>AR</span><strong>Archive</strong><small>All records</small></SiteLink>
      </nav>

      <HomeTransmissionDeck />

      <section className="home-city" aria-labelledby="home-city-title">
        <div className="rinse-section-head">
          <div>
            <span>Beyond the broadcast</span>
            <h2 id="home-city-title">From the city</h2>
          </div>
          <p>Stories, gatherings, and small signals from Bengaluru.</p>
        </div>
        <div className="city-card-row">
          <SiteLink className="city-card" href={sitePath("/read")}>
            <MediaFrame variant="editorial" frameClassName="city-card-frame" src={sitePath("/lowkal-logo.jpg")} alt="Lowkal illustrated mark" fill sizes="(max-width: 760px) 88vw, 47vw" />
            <div><span>Journal · 02</span><h3>Stories behind the signal.</h3><p>Read the room ↗</p></div>
          </SiteLink>
          <SiteLink className="city-card" href={sitePath("/go-out")}>
            <MediaFrame variant="editorial" frameClassName="city-card-frame" src={sitePath("/meeting-point.png")} alt="Meeting Point artwork" fill sizes="(max-width: 760px) 88vw, 47vw" />
            <div><span>City guide · 03</span><h3>Bengaluru is better off-screen.</h3><p>Go out ↗</p></div>
          </SiteLink>
        </div>
      </section>

      <aside className="home-open-call">
        <span>Open frequency · Submissions open</span>
        <p>Bring us a sound the city should remember.</p>
        <a href="mailto:hello@lowkal.fm?subject=Open%20frequency">Write to Lowkal ↗</a>
      </aside>
    </main>
  );
}
