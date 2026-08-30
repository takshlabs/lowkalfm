"use client";

import { Pause, Play } from "lucide-react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";
import { useListenContent } from "./ListenContentProvider";

export function HomeSessionShelf() {
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const { records } = useListenContent();
  const sessions = records.filter((record, index, items) => (
    record.showOnHome && items.findIndex((item) => item.youtubeId === record.youtubeId) === index
  ));

  return (
    <section className="home-sessions" aria-labelledby="home-sessions-title">
      <header className="home-section-head">
        <div>
          <span>Listen now</span>
          <h2 id="home-sessions-title">Recent sessions</h2>
        </div>
        <SiteLink href={sitePath("/listen/archive")}>Browse all records ↗</SiteLink>
      </header>

      <div className="home-session-shelf">
        {sessions.map((session, index) => {
          const isActive = activeRecord.slug === session.slug;
          const isSessionPlaying = isActive && isPlaying;

          return (
            <article className="home-session-card" key={session.slug}>
              <div className="home-session-media">
                <MediaFrame
                  variant="editorial"
                  frameClassName="home-session-frame"
                  src={session.artwork}
                  alt={`${session.artist} — ${session.title}`}
                  fill
                  sizes="(max-width: 680px) 84vw, 42vw"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isActive) togglePlayback();
                    else playRecord(session.slug);
                  }}
                  aria-label={`${isSessionPlaying ? "Pause" : "Play"} ${session.artist} — ${session.title}`}
                >
                  {isSessionPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="home-session-copy">
                <div>
                  <p>{session.series}</p>
                  <span>{session.date}</span>
                </div>
                <h3>{session.artist}</h3>
                <h4>{session.title}</h4>
                <div className="home-session-tags">
                  {session.genres.slice(0, 3).map((genre) => <span key={genre}>{genre}</span>)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
