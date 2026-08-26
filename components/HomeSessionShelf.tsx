"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { formatTime, soundRecords } from "@/lib/content";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";

/** One card per recording. Records that share a source appear once. */
const sessions = soundRecords.filter((record, index, records) => (
  records.findIndex((item) => item.youtubeId === record.youtubeId) === index
));

export function HomeSessionShelf() {
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const shelfRef = useRef<HTMLUListElement>(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /** Keeps the rail and the two steppers in step with the scroll position. */
  const measure = useCallback(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    const range = shelf.scrollWidth - shelf.clientWidth;
    const ratio = range > 8 ? shelf.scrollLeft / range : 1;
    setProgress(ratio);
    setAtStart(shelf.scrollLeft <= 8);
    setAtEnd(range <= 8 || shelf.scrollLeft >= range - 8);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /** Steps by one card plus its gap, so a card always lands flush. */
  const step = (direction: -1 | 1) => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    const card = shelf.querySelector<HTMLElement>(".shelf__card");
    const amount = card ? card.offsetWidth + 20 : shelf.clientWidth * 0.8;
    shelf.scrollBy({ left: amount * direction, behavior: "smooth" });
  };

  const railStyle = { "--shelf-progress": progress } as CSSProperties;

  return (
    <section className="shelf-section section on-night" aria-labelledby="shelf-title">
      <header className="section-head" data-reveal>
        <div className="section-head__body">
          <p className="section-kicker">Listen now</p>
          <h2 className="section-head__title" id="shelf-title">Recent sessions</h2>
        </div>
        <SiteLink className="link-quiet section-head__action" href={sitePath("/listen/archive")}>
          Browse all records ↗
        </SiteLink>
      </header>

      <ul className="shelf" ref={shelfRef} onScroll={measure} data-reveal-group>
        {sessions.map((session, index) => {
          const isActive = activeRecord.slug === session.slug;
          const isSessionPlaying = isActive && isPlaying;

          return (
            <li className={`shelf__card${isActive ? " is-active" : ""}`} key={session.slug} data-reveal>
              <article>
                <div className="shelf__media">
                  <MediaFrame
                    variant="fill"
                    src={session.artwork}
                    alt={`${session.artist} — ${session.title}`}
                    fill
                    sizes="(max-width: 680px) 84vw, 42vw"
                  />
                  <span className="shelf__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="shelf__duration tnum">{formatTime(session.duration)}</span>
                  <button
                    type="button"
                    className="shelf__play"
                    onClick={() => {
                      if (isActive) togglePlayback();
                      else playRecord(session.slug);
                    }}
                    aria-label={`${isSessionPlaying ? "Pause" : "Play"} ${session.artist} — ${session.title}`}
                  >
                    {isSessionPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  </button>
                </div>

                <div className="shelf__copy">
                  <div className="shelf__meta label label--sm">
                    <p>{session.series}</p>
                    <span>{session.date}</span>
                  </div>
                  <h3 className="shelf__artist">{session.artist}</h3>
                  <p className="shelf__title">{session.title}</p>
                  <ul className="shelf__tags" aria-label="Genres">
                    {session.genres.slice(0, 3).map((genre) => (
                      <li className="tag" key={genre}>{genre}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="shelf-controls" style={railStyle}>
        <span className="shelf-controls__rail" aria-hidden="true">
          <i />
        </span>
        <button
          type="button"
          className="shelf-controls__step"
          onClick={() => step(-1)}
          disabled={atStart}
          aria-label="Scroll to earlier sessions"
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="shelf-controls__step"
          onClick={() => step(1)}
          disabled={atEnd}
          aria-label="Scroll to later sessions"
        >
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
