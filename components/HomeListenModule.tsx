"use client";

import Image from "next/image";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { Pause, Play } from "lucide-react";
import { soundRecords } from "@/lib/content";
import { useAudio } from "./AudioProvider";

export function HomeListenModule() {
  const latest = soundRecords[0];
  const { activeRecord, isPlaying, playRecord, togglePlayback } = useAudio();
  const isLatestActive = activeRecord.slug === latest.slug;

  const handlePlay = () => {
    if (isLatestActive) togglePlayback();
    else playRecord(latest.slug);
  };

  return (
    <section className="home-listen-module" aria-labelledby="home-listen-title">
      <div className="listen-art-wrap">
        <Image src={latest.artwork} alt={`${latest.series} artwork`} fill sizes="(max-width: 800px) 100vw, 44vw" />
        <span className="listen-broadcast-mark">Weekly transmission · New</span>
      </div>
      <div className="listen-module-copy">
        <span className="section-kicker">Listen · Lowkal Soundroom</span>
        <h2 id="home-listen-title">{latest.series}</h2>
        <p className="listen-artist">{latest.artist} — {latest.title}</p>
        <p>{latest.description}</p>
        <div className="listen-actions">
          <button type="button" className="round-play" onClick={handlePlay} aria-label={`${isPlaying && isLatestActive ? "Pause" : "Play"} ${latest.series}`}>
            {isPlaying && isLatestActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <SiteLink href={sitePath("/listen")}>Enter Soundroom ↗</SiteLink>
        </div>
      </div>
    </section>
  );
}
