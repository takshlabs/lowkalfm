"use client";

import { Pause, Play } from "lucide-react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { soundRecords } from "@/lib/content";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";

export function HomeTransmissionDeck() {
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();

  const toggleRecord = (slug: string) => {
    if (activeRecord.slug === slug) togglePlayback();
    else playRecord(slug);
  };

  return (
    <section className="home-transmissions" aria-labelledby="home-transmissions-title">
      <div className="rinse-section-head">
        <div>
          <span>On demand · Lowkal archive</span>
          <h2 id="home-transmissions-title">Latest transmissions</h2>
        </div>
        <SiteLink href={sitePath("/listen/archive")}>See the full archive ↗</SiteLink>
      </div>

      <div className="transmission-row">
        {soundRecords.slice(0, 2).map((record, index) => {
          const active = activeRecord.slug === record.slug;
          const playing = active && isPlaying;

          return (
            <article className="transmission-card" key={record.slug}>
              <div className="transmission-media">
                <MediaFrame variant="editorial" frameClassName="transmission-frame" src={record.artwork} alt={`${record.series} artwork`} fill sizes="(max-width: 760px) 88vw, 47vw" priority={index === 0} />
                <div className="transmission-channel"><span>●</span> BLR · {String(index + 1).padStart(2, "0")}</div>
                <button type="button" onClick={() => toggleRecord(record.slug)} aria-label={`${playing ? "Pause" : "Play"} ${record.series}`}>
                  {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <div className="transmission-overlay">
                  <p>{record.artist}</p>
                  <h3>{record.series}</h3>
                  <span>{record.title}</span>
                </div>
              </div>
              <div className="transmission-tags" aria-label="Genres">
                {record.genres.map((genre) => <span key={genre}>{genre}</span>)}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
