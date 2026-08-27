import type { Metadata } from "next";
import { MediaFrame } from "@/components/MediaFrame";
import { cityEvents } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Go out",
  description: "Lowkal's considered guide to listening sessions, workshops, nights and independent spaces in Bengaluru."
};

export default function GoOutPage() {
  return (
    <main className="city-page">
      <section className="section-page-hero city-hero">
        <MediaFrame variant="hero" frameClassName="section-hero-art city-hero-art" src={sitePath("/art/ember-bloom.jpg")} alt="Red and orange flower emerging from a dark field" fill sizes="(max-width: 680px) 70vw, 38vw" priority />
        <span className="section-kicker">03 · Go out</span>
        <h1>A small guide<br />to a <em>large city.</em></h1>
        <p>Selected nights and independent spaces in Bengaluru.</p>
      </section>
      <section className="city-guide" aria-labelledby="city-guide-title">
        <div className="city-guide-head">
          <span className="section-kicker">Bengaluru · This week</span>
          <h2 id="city-guide-title">Selected by Lowkal.</h2>
        </div>
        <div className="city-event-list">
          {cityEvents.length === 0 ? (
            <div className="city-empty">
              <MediaFrame variant="editorial" frameClassName="empty-art-panel city-empty-art" src={sitePath("/art/floral-exposure.jpg")} alt="Red floral exposure on a dark background" fill sizes="(max-width: 680px) 100vw, 38vw" />
              <div className="empty-copy city-empty-copy">
                <span>Next listing</span>
                <h3>The next Lowkal gathering will appear here.</h3>
                <p>Follow Lowkal for the next date.</p>
                <a href="https://www.instagram.com/lowkal.fm/" target="_blank" rel="noreferrer">Open Instagram ↗</a>
              </div>
            </div>
          ) : null}
          {cityEvents.map((event, index) => (
            <article key={event.title}>
              <span className="city-event-index">0{index + 1}</span>
              <time><strong>{event.date}</strong><span>{event.time}</span></time>
              <div><span>{event.type}</span><h3>{event.title}</h3></div>
              <p><strong>{event.venue}</strong><span>{event.access}</span></p>
              <details className="city-event-details">
                <summary aria-label={`View details for ${event.title}`}>Details ↘</summary>
                <div><strong>Why Lowkal picked it</strong><span>{event.reason}</span></div>
              </details>
            </article>
          ))}
        </div>
      </section>
      <section className="city-principle">
        <span className="section-kicker">The Lowkal guide</span>
        <blockquote>“Independent, useful, and clear.”</blockquote>
        <a href="mailto:hello@lowkal.fm?subject=City%20guide%20suggestion">Suggest something ↗</a>
      </section>
    </main>
  );
}
