"use client";

import type { CSSProperties } from "react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { sitePath } from "@/lib/site-path";
import { ArrowUpRight, Pause, Play, Volume2 } from "lucide-react";
import { formatTime } from "@/lib/content";
import { usePathname } from "next/navigation";
import { useAudio } from "./AudioProvider";

export function PersistentPlayer() {
  const pathname = usePathname();
  const { activeRecord, currentTime, duration, isPlaying, isReady, volume, togglePlayback, seek, setVolume } = useAudio();
  const total = duration || activeRecord.duration;
  const progress = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;
  const progressStyle = { "--deck-progress": `${progress}%` } as CSSProperties;
  const volumeStyle = { "--deck-volume": `${volume}%` } as CSSProperties;
  const volumeLabel = Math.round(volume).toString().padStart(2, "0");

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <aside className={`lowkal-player${isPlaying ? " is-playing" : ""}`} aria-label="Lowkal audio player">
      <div className="lowkal-player-rail" aria-hidden="true">
        <span>LOWKAL.FM</span>
        <i />
        <small>BLR · RX 01</small>
      </div>

      <div className="lowkal-player-art">
        <MediaFrame variant="record" src={activeRecord.artwork} alt="" width={82} height={82} />
        <span className="lowkal-player-art-index" aria-hidden="true">REC</span>
        <div className="lowkal-player-meter" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
      </div>

      <button
        className="lowkal-player-transport"
        type="button"
        onClick={togglePlayback}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${activeRecord.series}`}
        disabled={!isReady}
      >
        <span className="lowkal-player-transport-icon">
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </span>
        <span className="lowkal-player-transport-copy" aria-hidden="true">
          <small>Transport</small>
          <strong>{isPlaying ? "Pause" : "Play"}</strong>
        </span>
      </button>

      <div className="lowkal-player-program" aria-live="polite">
        <div className="lowkal-player-status">
          <span><i aria-hidden="true" /> {isPlaying ? "Broadcasting" : "Player ready"}</span>
          <span>{activeRecord.format === "weekly" ? "Weekly volume" : "Program set"}</span>
        </div>
        <SiteLink className="lowkal-player-title" href={sitePath("/listen")}>{activeRecord.artist}</SiteLink>
        <span className="lowkal-player-record">{activeRecord.series} <i>{"///"}</i> {activeRecord.title}</span>
      </div>

      <label className="lowkal-player-timeline">
        <span className="sr-only">Playback position</span>
        <div className="lowkal-player-timecode" aria-hidden="true">
          <span>{formatTime(currentTime)}</span>
          <span>Position</span>
          <span>{formatTime(total)}</span>
        </div>
        <span className="lowkal-player-track">
          <input
            type="range"
            min={0}
            max={Math.max(1, total)}
            step={1}
            value={Math.min(currentTime, Math.max(1, total))}
            style={progressStyle}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <i aria-hidden="true" />
        </span>
      </label>

      <div className="lowkal-player-utility">
        <label className="lowkal-player-volume">
          <span className="lowkal-player-volume-head">
            <Volume2 aria-hidden="true" />
            <span>Level</span>
            <output>{volumeLabel}</output>
          </span>
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            style={volumeStyle}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        <SiteLink className="lowkal-player-room" href={sitePath("/listen")}>
          <span><small>Full archive</small><strong>Soundroom</strong></span>
          <ArrowUpRight aria-hidden="true" />
        </SiteLink>
      </div>
    </aside>
  );
}
