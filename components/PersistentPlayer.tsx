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
  const progressStyle = { "--player-progress": `${progress}%` } as CSSProperties;
  const volumeStyle = { "--player-volume": `${volume}%` } as CSSProperties;

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <aside className="persistent-player" aria-label="Lowkal audio player">
      <div className="player-main">
        <div className="player-artwork">
          <MediaFrame variant="record" src={activeRecord.artwork} alt="" width={64} height={64} />
          <div className={`player-equalizer${isPlaying ? " is-active" : ""}`} aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </div>

        <button
          className="player-play"
          type="button"
          onClick={togglePlayback}
          aria-label={`${isPlaying ? "Pause" : "Play"} ${activeRecord.series}`}
          disabled={!isReady}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>

        <div className="player-copy" aria-live="polite">
          <span className="player-kicker">{isPlaying ? "Playing now" : "Ready when you are"}</span>
          <SiteLink href={sitePath("/listen")}>{activeRecord.artist}</SiteLink>
          <span>{activeRecord.series} <i>/</i> {activeRecord.title}</span>
        </div>

        <div className="player-secondary-controls">
          <label className="player-volume">
            <Volume2 aria-hidden="true" />
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
          <SiteLink className="player-room-link" href={sitePath("/listen")}>
            Soundroom <ArrowUpRight aria-hidden="true" />
          </SiteLink>
        </div>
      </div>

      <div className="player-timeline">
        <span className="player-time">{formatTime(currentTime)}</span>
        <label className="player-progress">
          <span className="sr-only">Playback position</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, total)}
            step={1}
            value={Math.min(currentTime, Math.max(1, total))}
            style={progressStyle}
            onChange={(event) => seek(Number(event.target.value))}
          />
        </label>
        <span className="player-time">{formatTime(total)}</span>
      </div>
    </aside>
  );
}
