"use client";

import Image from "next/image";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { Pause, Play, Volume2 } from "lucide-react";
import { formatTime } from "@/lib/content";
import { useAudio } from "./AudioProvider";

export function PersistentPlayer() {
  const { activeRecord, currentTime, duration, isPlaying, isReady, volume, togglePlayback, seek, setVolume } = useAudio();
  const total = duration || activeRecord.duration;

  return (
    <aside className="persistent-player" aria-label="Lowkal persistent audio player">
      <Image src={activeRecord.artwork} alt="" width={48} height={48} />
      <button
        className="player-play"
        type="button"
        onClick={togglePlayback}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${activeRecord.series}`}
        disabled={!isReady}
      >
        {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <div className="player-copy">
        <SiteLink href={sitePath("/listen")}>{activeRecord.series}</SiteLink>
        <span>{activeRecord.artist} · {activeRecord.title}</span>
      </div>
      <label className="player-progress">
        <span className="sr-only">Playback position</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, total)}
          step={1}
          value={Math.min(currentTime, Math.max(1, total))}
          onChange={(event) => seek(Number(event.target.value))}
        />
      </label>
      <span className="player-time">{formatTime(currentTime)} / {formatTime(total)}</span>
      <label className="player-volume">
        <Volume2 aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
      </label>
      <SiteLink className="player-room-link" href={sitePath("/listen")}>Open Soundroom ↗</SiteLink>
    </aside>
  );
}
