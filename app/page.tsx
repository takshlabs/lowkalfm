import Link from "next/link";
import { HomeListenModule } from "@/components/HomeListenModule";
import { cityEvents, journalStories } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

const portals = [
  { number: "01", name: "Listen", href: "/listen", note: "Enter Lowkal Soundroom", copy: "Weekly Lowkal.fm volumes, live programs, featured sets and the full record library." },
  { number: "02", name: "Read", href: "/read", note: "Open the journal", copy: "Artist conversations, field notes, photo essays and stories from the people behind the sound." },
  { number: "03", name: "Go out", href: "/go-out", note: "See the city guide", copy: "A small, considered guide to nights, listening sessions, workshops and independent spaces." }
];

export default function Home() {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <div className="home-statement">
          <div className="eyebrow">Bengaluru community radio · Independent culture</div>
          <h1>The city has a <em>frequency.</em><br />We tune in.</h1>
          <div className="statement-footer">
            <p>Music, field notes, people and nights from the city—broadcast live and kept with care.</p>
            <span>Weekly mixes · Bi-monthly live programs · Always listening</span>
          </div>
        </div>
        <div className="portal-grid" aria-label="Explore Lowkal">
          {portals.map((portal) => (
            <Link className={`portal portal-${portal.number}`} href={sitePath(portal.href)} key={portal.name}>
              <span className="portal-number">{portal.number}</span>
              <span className="portal-name">{portal.name}</span>
              <span className="portal-copy">{portal.copy}</span>
              <span className="portal-note">{portal.note} ↗</span>
            </Link>
          ))}
        </div>
      </section>

      <HomeListenModule />

      <section className="home-read" aria-labelledby="home-read-title">
        <div className="home-section-intro">
          <span className="section-kicker">Read · From the journal</span>
          <h2 id="home-read-title">Stories behind the signal.</h2>
          <Link href={sitePath("/read")}>Read all stories ↗</Link>
        </div>
        <div className="home-story-grid">
          {journalStories.slice(0, 3).map((story, index) => (
            <article className={`home-story story-${story.tone}`} key={story.title}>
              <span className="story-index">0{index + 1}</span>
              <span className="story-type">{story.type}</span>
              <h3>{story.title}</h3>
              <p>{story.deck}</p>
              <span>{story.readTime}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-events" aria-labelledby="home-events-title">
        <div className="home-section-intro">
          <span className="section-kicker">Go out · Lowkal city guide</span>
          <h2 id="home-events-title">This week in the city.</h2>
          <Link href={sitePath("/go-out")}>Open the guide ↗</Link>
        </div>
        <div className="home-event-list">
          {cityEvents.slice(0, 3).map((event) => (
            <article key={event.title}>
              <time>{event.date}<br />{event.time}</time>
              <div><span>{event.type}</span><h3>{event.title}</h3></div>
              <p>{event.venue}</p>
              <p>{event.access}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="open-frequency">
        <span className="section-kicker">Take part · Open frequency</span>
        <h2>Bring us a sound the city should remember.</h2>
        <p>Propose a mix, pitch a story, share a field recording or help with a listening session.</p>
        <a href="mailto:hello@lowkal.fm?subject=Open%20frequency">Write to Lowkal ↗</a>
      </section>
    </main>
  );
}
