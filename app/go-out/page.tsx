import type { Metadata } from "next";
import { cityEvents } from "@/lib/content";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Go out",
  description: "Lowkal's considered guide to listening sessions, workshops, nights and independent spaces in Bengaluru."
};

export default function GoOutPage() {
  return (
    <main className="on-paper" id="main">
      <section className="page-hero city-hero on-red">
        <span className="page-hero__ghost" aria-hidden="true">03</span>
        <p className="section-kicker">03 · Go out</p>
        <h1 className="page-hero__title">A small guide to a <em>large city.</em></h1>
        <p className="page-hero__note">
          We list fewer things and say more about them. Each entry includes useful access
          notes and a reason to go.
        </p>
      </section>

      <section className="city-guide section" aria-labelledby="city-guide-title">
        <header className="section-head" data-reveal>
          <div className="section-head__body">
            <p className="section-kicker">Bengaluru · This week</p>
            <h2 className="section-head__title" id="city-guide-title">Selected by Lowkal.</h2>
          </div>
        </header>

        <div className="city-event-list">
          {cityEvents.length === 0 ? (
            <div className="empty-state bleed">
              <p className="section-kicker">Next listing</p>
              <h3>The next Lowkal gathering will appear here.</h3>
              <p>Follow Lowkal for the date, place, artists, cost, and access information.</p>
              <a
                className="link-quiet"
                href="https://www.instagram.com/lowkal.fm/"
                target="_blank"
                rel="noreferrer"
              >
                Open Instagram ↗
              </a>
            </div>
          ) : null}

          {cityEvents.map((event, index) => (
            <article className="city-event" key={event.title}>
              <p className="city-event__index">{String(index + 1).padStart(2, "0")}</p>

              <time>
                <strong>{event.date}</strong>
                <span className="label label--sm">{event.time}</span>
              </time>

              <div className="city-event__title">
                <span className="label label--sm label--muted">{event.type}</span>
                <h3>{event.title}</h3>
              </div>

              <p className="city-event__venue">
                <strong>{event.venue}</strong>
                <span className="label label--sm">{event.access}</span>
              </p>

              <details>
                <summary aria-label={`View details for ${event.title}`}>Details ↘</summary>
                <div>
                  <strong className="label label--sm">Why Lowkal picked it</strong>
                  <span>{event.reason}</span>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-note on-night" aria-labelledby="city-principle-title">
        <p className="section-kicker">The Lowkal guide</p>
        <blockquote id="city-principle-title">
          “Useful before exhaustive. Independent before obvious. Clear about cost and access.”
        </blockquote>
        <a className="link-quiet" href="mailto:hello@lowkal.fm?subject=City%20guide%20suggestion">
          Suggest something ↗
        </a>
      </section>
    </main>
  );
}
