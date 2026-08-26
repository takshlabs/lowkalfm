import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { getSoundRecord, livePrograms } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

export function HomeProgrammeIndex() {
  return (
    <section
      className="programmes section on-paper"
      id="programmes"
      aria-labelledby="programmes-title"
    >
      <header className="section-head" data-reveal>
        <div className="section-head__body">
          <p className="section-kicker">Programme index</p>
          <h2 className="section-head__title" id="programmes-title">
            Each gathering stays together.
          </h2>
        </div>
        <p className="section-head__note">
          Sets, people, and the complete programme record in one place.
        </p>
      </header>

      <div className="programme-grid" data-reveal-group>
        {livePrograms.map((programme) => {
          const record = getSoundRecord(programme.featuredSetSlug);
          if (!record) return null;

          return (
            <article className="programme-card" key={programme.slug} data-reveal>
              <MediaFrame
                variant="fill"
                src={record.artwork}
                alt={`${programme.label} artwork`}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
              />
              <div className="programme-card__body">
                <div className="programme-card__meta label label--sm">
                  <span>Lowkal {programme.number}</span>
                  <span>{programme.date}</span>
                </div>
                <p className="programme-card__numeral" aria-hidden="true">{programme.number}</p>
                <h3 className="programme-card__name">{programme.name}</h3>
                <p className="programme-card__note">{programme.description}</p>
                <SiteLink className="link-quiet" href={sitePath("/listen/archive")}>
                  Open programme record ↗
                </SiteLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
