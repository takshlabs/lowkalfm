"use client";

import { Pause, Play } from "lucide-react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { formatTime, soundRecords } from "@/lib/content";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";

const featured = soundRecords[0];

/** "Lowkal 002 | Garden City Gallivanting" splits into a label and a name. */
const [seriesLabel, ...seriesRest] = featured.series.split("|");
const programmeLabel = seriesLabel.trim();
const programmeName = seriesRest.length > 0 ? seriesRest.join("|").trim() : featured.series;
const programmeNumber = programmeLabel.match(/\d+/)?.[0] ?? "";

export function HomeStage() {
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const isFeaturedActive = activeRecord.slug === featured.slug;
  const isFeaturedPlaying = isFeaturedActive && isPlaying;

  const handlePlay = () => {
    if (isFeaturedActive) togglePlayback();
    else playRecord(featured.slug);
  };

  return (
    <section className="stage on-night" aria-labelledby="stage-title">
      <div className="stage__utility label label--sm">
        <span>Bengaluru</span>
        <span>Multi-genre</span>
        <span>Low-end focused</span>
        <span className="tnum">{formatTime(featured.duration)}</span>
      </div>

      <div className="stage__grid">
        <div className="stage__media">
          <MediaFrame
            variant="fill"
            src={featured.artwork}
            alt={`${featured.artist} performing at ${featured.series}`}
            fill
            sizes="(max-width: 980px) 100vw, 62vw"
            priority
          />
          <span className="stage__stamp">Latest session</span>
          {programmeNumber ? (
            <span className="stage__numeral" aria-hidden="true">{programmeNumber}</span>
          ) : null}
          <span className="stage__cue label label--sm" aria-hidden="true">
            Scroll
            <i />
          </span>
        </div>

        <div className="stage__plate on-red">
          <div className="stage__plate-head label label--sm">
            <span>{programmeLabel}</span>
            <span>{featured.date}</span>
          </div>

          <div className="stage__titles">
            <span className="stage__eyebrow">Latest Lowkal programme</span>
            <h1 className="stage__title" id="stage-title">{programmeName}</h1>
            <p className="stage__artist">{featured.artist}</p>
            <p className="stage__intro">Multi-genre. Low-end focused. From Bengaluru.</p>
          </div>

          <div className="stage__actions">
            <button
              type="button"
              className="play-control"
              onClick={handlePlay}
              aria-label={`${isFeaturedPlaying ? "Pause" : "Play"} ${featured.artist} — ${featured.title}`}
            >
              <span className="play-control__disc">
                {isFeaturedPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </span>
              <span>{isFeaturedPlaying ? "Pause session" : "Play session"}</span>
            </button>

            <SiteLink className="link-quiet" href={sitePath("/listen/archive")}>
              Open Archive Room ↗
            </SiteLink>
          </div>

          <ul className="stage__tags" aria-label="Session genres">
            {featured.genres.map((genre) => (
              <li className="tag" key={genre}>{genre}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
