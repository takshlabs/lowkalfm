"use client";

import { Pause, Play } from "lucide-react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { soundRecords } from "@/lib/content";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";

const featured = soundRecords[0];
const programmeName = featured.series.includes("|")
  ? featured.series.split("|").slice(1).join("|").trim()
  : featured.series;

export function HomeStage() {
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const isFeaturedActive = activeRecord.slug === featured.slug;

  const handlePlay = () => {
    if (isFeaturedActive) togglePlayback();
    else playRecord(featured.slug);
  };

  return (
    <section className="home-stage" aria-labelledby="home-stage-title">
      <div className="home-stage-utility">
        <span>Bengaluru</span>
        <span>Multi-genre</span>
        <span>Low-end focused</span>
      </div>

      <div className="home-stage-grid">
        <div className="home-stage-media">
          <MediaFrame
            variant="hero"
            frameClassName="home-stage-frame"
            src={featured.artwork}
            alt={`${featured.artist} performing at ${featured.series}`}
            fill
            sizes="(max-width: 760px) 100vw, 62vw"
            priority
          />
          <span className="home-stage-stamp">Latest session</span>
        </div>

        <div className="home-stage-copy">
          <div className="home-stage-copy-head">
            <span>{featured.series.split("|")[0].trim()}</span>
            <span>{featured.date}</span>
          </div>
          <div className="home-stage-title-block">
            <p>Latest Lowkal programme</p>
            <h1 id="home-stage-title">{programmeName}</h1>
            <h2>{featured.artist}</h2>
          </div>
          <p className="home-stage-intro">Multi-genre. Low-end focused. From Bengaluru.</p>
          <div className="home-stage-actions">
            <button type="button" onClick={handlePlay} aria-label={`${isFeaturedActive && isPlaying ? "Pause" : "Play"} ${featured.artist} — ${featured.title}`}>
              <span className="home-stage-play-icon">
                {isFeaturedActive && isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </span>
              <span>{isFeaturedActive && isPlaying ? "Pause session" : "Play session"}</span>
            </button>
            <SiteLink href={sitePath("/listen/archive")}>Open Archive Room ↗</SiteLink>
          </div>
          <div className="home-stage-tags" aria-label="Session genres">
            {featured.genres.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
