import type { Metadata } from "next";
import { journalStories } from "@/lib/content";

export const metadata: Metadata = {
  title: "Read",
  description: "Artist conversations, field notes, photo essays and reported stories from Lowkal."
};

export default function ReadPage() {
  return (
    <main className="journal-page">
      <section className="section-page-hero read-hero">
        <span className="section-kicker">02 · Read</span>
        <h1>Stories behind<br />the <em>signal.</em></h1>
        <p>Artist conversations, field notes, photo essays, oral histories and reported work from the people who make the city sound like itself.</p>
      </section>
      <section className="journal-grid" aria-label="Latest stories">
        {journalStories.map((story, index) => (
          <article className={`journal-story journal-${story.tone}`} key={story.title}>
            <div className="journal-story-art" aria-hidden="true"><span>0{index + 1}</span></div>
            <div className="journal-story-copy">
              <span>{story.type} · {story.readTime}</span>
              <h2>{story.title}</h2>
              <p>{story.deck}</p>
              <small>By {story.byline}</small>
              <details className="journal-story-details">
                <summary>Read an excerpt ↘</summary>
                <p>{story.excerpt}</p>
              </details>
            </div>
          </article>
        ))}
      </section>
      <section className="journal-note">
        <span className="section-kicker">Pitch Lowkal</span>
        <h2>A good story can begin with one sound.</h2>
        <a href="mailto:hello@lowkal.fm?subject=Story%20pitch">Send a short pitch ↗</a>
      </section>
    </main>
  );
}
