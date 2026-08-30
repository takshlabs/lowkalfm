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
        <div className="rinse-hero-copy">
          <span>Lowkal.fm · Bengaluru</span>
          <h1 id="rinse-hero-title">The city has a frequency.</h1>
          <p>Independent radio from Bengaluru.</p>
          <SiteLink href={sitePath("/listen")}>Enter soundroom <span aria-hidden="true">↗</span></SiteLink>
        </div>
        <div className="rinse-hero-art">
          <MediaFrame variant="hero" frameClassName="rinse-hero-frame" src={sitePath("/art/bengaluru-sound-system-hero.png")} alt="Night-time Bengaluru street collage with a stacked sound system, flowers, and people" fill sizes="100vw" priority />
          <div className="rinse-hero-wash" aria-hidden="true" />
        </div>
      </section>

      <nav className="home-channel-row" aria-label="Lowkal channels">
        <SiteLink href={sitePath("/listen")}><span className="channel-index">01</span><span className="channel-spectrum" aria-hidden="true"><b /></span><strong>Listen</strong><small>Soundroom · 93.5</small><i aria-hidden="true">↗</i></SiteLink>
        <SiteLink href={sitePath("/read")}><span className="channel-index">02</span><span className="channel-spectrum" aria-hidden="true"><b /></span><strong>Read</strong><small>City journal · BLR</small><i aria-hidden="true">↗</i></SiteLink>
        <SiteLink href={sitePath("/go-out")}><span className="channel-index">03</span><span className="channel-spectrum" aria-hidden="true"><b /></span><strong>Go out</strong><small>Local signal · Tonight</small><i aria-hidden="true">↗</i></SiteLink>
        <SiteLink href={sitePath("/listen/archive")}><span className="channel-index">AR</span><span className="channel-spectrum" aria-hidden="true"><b /></span><strong>Archive</strong><small>Recorded in Bengaluru</small><i aria-hidden="true">↗</i></SiteLink>
      </nav>

      <HomeTransmissionDeck />

      <section className="home-city" aria-labelledby="home-city-title">
        <div className="rinse-section-head">
          <div>
            <span>City notes</span>
            <h2 id="home-city-title">From the city</h2>
          </div>
        </div>
        <div className="city-card-row">
          <SiteLink className="city-card" href={sitePath("/read")}>
            <MediaFrame variant="editorial" frameClassName="city-card-frame" src={sitePath("/art/eye-in-hand.jpg")} alt="Green collage of a face, hands, and painted eyes" fill sizes="(max-width: 760px) 88vw, 31vw" />
            <div><span>Journal · 02</span><h3>Stories behind the signal.</h3><p>Read the room ↗</p></div>
          </SiteLink>
          <SiteLink className="city-card" href={sitePath("/go-out")}>
            <MediaFrame variant="editorial" frameClassName="city-card-frame" src={sitePath("/art/ember-bloom.jpg")} alt="Red and orange flower emerging from a dark field" fill sizes="(max-width: 760px) 88vw, 31vw" />
            <div><span>City guide · 03</span><h3>Bengaluru is better off-screen.</h3><p>Go out ↗</p></div>
          </SiteLink>
          <SiteLink className="city-card" href={sitePath("/listen/archive")}>
            <MediaFrame variant="editorial" frameClassName="city-card-frame" src={sitePath("/lowkal-002.jpg")} alt="Lowkal 002 archive artwork" fill sizes="(max-width: 760px) 88vw, 31vw" />
            <div><span>Archive · 01</span><h3>Sessions worth returning to.</h3><p>Browse records ↗</p></div>
          </SiteLink>
        </div>
      </section>

      <aside className="home-open-call">
        <span>Submissions open</span>
        <p>Send us a sound worth keeping.</p>
        <a href="mailto:hello@lowkal.fm?subject=Open%20frequency">Write to Lowkal ↗</a>
      </aside>
    </main>
  );
}
