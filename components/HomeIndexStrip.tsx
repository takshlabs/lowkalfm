import { SiteLink } from "@/components/SiteLink";
import { livePrograms } from "@/lib/content";
import { sitePath } from "@/lib/site-path";

/**
 * A short jump list under the stage. It reads straight from the programme
 * record, so a new Lowkal edition appears here without a second edit.
 */
export function HomeIndexStrip() {
  return (
    <nav className="index-strip" aria-label="Lowkal programme shortcuts">
      {livePrograms.map((programme) => (
        <a className="index-strip__item" href="#programmes" key={programme.slug}>
          <span className="index-strip__num">{programme.number}</span>
          <span className="index-strip__name">{programme.name}</span>
          <span className="index-strip__meta label label--sm">{programme.date}</span>
        </a>
      ))}

      <SiteLink className="index-strip__item" href={sitePath("/listen/archive")}>
        <span className="index-strip__num">AR</span>
        <span className="index-strip__name">Archive Room</span>
        <span className="index-strip__meta label label--sm">All records ↗</span>
      </SiteLink>
    </nav>
  );
}
