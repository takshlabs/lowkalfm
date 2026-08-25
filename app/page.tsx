import { SiteLink } from "@/components/SiteLink";
import { HomeFrequencyHero } from "@/components/HomeFrequencyHero";
import { HomeListenModule } from "@/components/HomeListenModule";
import { cityEvents, journalStories } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export default function Home() {
  const featuredStory = journalStories[0];
  const featuredEvent = cityEvents[0];

  return (
    <main className="home-shell">
      <HomeFrequencyHero />

      <div className="home-broadcast-marquee" aria-hidden="true">
        <div>
          <span>Now transmitting from Bengaluru</span>
          <i>◆</i>
          <span>Listen deeper</span>
          <i>◆</i>
          <span>Read the city</span>
          <i>◆</i>
          <span>Meet outside</span>
          <i>◆</i>
          <span>Now transmitting from Bengaluru</span>
          <i>◆</i>
          <span>Listen deeper</span>
          <i>◆</i>
          <span>Read the city</span>
          <i>◆</i>
          <span>Meet outside</span>
        </div>
      </div>

      <HomeListenModule />

      <section className="home-channels" aria-labelledby="home-channels-title">
        <div className="home-channels-intro">
          <span className="section-kicker">Two more ways into Lowkal</span>
          <h2 id="home-channels-title">The signal does not end at sound.</h2>
          <p>We follow it into stories, rooms, streets and the people who keep the city moving.</p>
        </div>
        <div className="home-channel-grid">
          <SiteLink className="home-channel-card home-channel-read" href={sitePath("/read")} aria-label="Open the Lowkal journal">
            <div className="home-channel-rail"><span>02 · Journal</span><span>Words after the speakers go quiet</span></div>
            <span className="home-channel-script" aria-hidden="true">পড়ুন · ಓದಿ</span>
            <h3>Read</h3>
            <p>{featuredStory?.title ?? "Stories behind the signal."}</p>
            <span>{featuredStory?.deck ?? "Artist conversations, field notes and photo essays from the people behind the sound."}</span>
            <strong>{featuredStory ? "Read the story" : "Open the journal"} ↗</strong>
          </SiteLink>
          <SiteLink className="home-channel-card home-channel-out" href={sitePath("/go-out")} aria-label="Open the Lowkal city guide">
            <div className="home-channel-rail"><span>03 · City guide</span><span>Useful before exhaustive</span></div>
            <span className="home-channel-script" aria-hidden="true">ಹೊರಗೆ · বাইরে</span>
            <h3>Go out</h3>
            <p>{featuredEvent?.title ?? "Bengaluru is better off-screen."}</p>
            <span>{featuredEvent ? `${featuredEvent.date} · ${featuredEvent.venue}` : "A small guide to nights, listening sessions, workshops and independent spaces."}</span>
            <strong>{featuredEvent ? "See the event" : "Open the guide"} ↗</strong>
          </SiteLink>
        </div>
      </section>

      <section className="open-frequency">
        <div className="open-frequency-rail">
          <span>Take part · Open frequency</span>
          <span>Submissions open · Bengaluru and beyond</span>
        </div>
        <div className="open-frequency-copy">
          <span className="section-kicker">Your turn on the dial</span>
          <h2>Bring us a sound the city should remember.</h2>
          <p>Propose a mix, pitch a story, share a field recording or help with a listening session.</p>
          <a href="mailto:hello@lowkal.fm?subject=Open%20frequency">Write to Lowkal <span aria-hidden="true">↗</span></a>
        </div>
        <div className="open-frequency-orbit" aria-hidden="true"><span>LOWKAL · OPEN CHANNEL · BLR ·</span></div>
      </section>
    </main>
  );
}
