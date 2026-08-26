import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { getSoundRecord, livePrograms } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

export function HomeProgrammeIndex() {
  return (
    <section className="home-programmes" id="programmes" aria-labelledby="home-programmes-title">
      <header className="home-section-head home-section-head--paper">
        <div>
          <span>Programme index</span>
          <h2 id="home-programmes-title">Each gathering stays together.</h2>
        </div>
        <p>Sets, people, and the complete programme record in one place.</p>
      </header>

      <div className="home-programme-grid">
        {livePrograms.map((programme) => {
          const record = getSoundRecord(programme.featuredSetSlug);
          if (!record) return null;

          return (
            <article className="home-programme-card" key={programme.slug}>
              <MediaFrame
                variant="editorial"
                frameClassName="home-programme-art"
                src={record.artwork}
                alt={`${programme.label} artwork`}
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <div className="home-programme-overlay">
                <div className="home-programme-meta">
                  <span>Lowkal {programme.number}</span>
                  <span>{programme.date}</span>
                </div>
                <h3>{programme.name}</h3>
                <p>{programme.description}</p>
                <SiteLink href={sitePath("/listen/archive")}>Open programme record ↗</SiteLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
