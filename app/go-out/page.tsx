import type { Metadata } from "next";
import { cityEvents } from "@/lib/content";

export const metadata: Metadata = {
  title: "Go out",
  description: "Lowkal's considered guide to listening sessions, workshops, nights and independent spaces in Bengaluru."
};

export default function GoOutPage() {
  return (
    <main className="city-page">
      <section className="section-page-hero city-hero">
        <span className="section-kicker">03 · Go out</span>
        <h1>A small guide<br />to a <em>large city.</em></h1>
        <p>We list fewer things and say more about them. Each entry includes useful access notes and a reason to go.</p>
      </section>
      <section className="city-guide" aria-labelledby="city-guide-title">
        <div className="city-guide-head">
          <span className="section-kicker">Bengaluru · This week</span>
          <h2 id="city-guide-title">Selected by Lowkal.</h2>
        </div>
        <div className="city-event-list">
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
        <blockquote>“Useful before exhaustive. Independent before obvious. Clear about cost and access.”</blockquote>
        <a href="mailto:hello@lowkal.fm?subject=City%20guide%20suggestion">Suggest something ↗</a>
      </section>
    </main>
  );
}
