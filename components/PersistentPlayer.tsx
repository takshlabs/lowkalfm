"use client";

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { ArrowUpRight, Pause, Play, RotateCcw, Video, Volume2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { formatTime } from "@/lib/content";
import { isUnlistedPath } from "@/lib/site-chrome";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";

export function PersistentPlayer() {
  const pathname = usePathname();
  const { activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, volume, togglePlayback, retryPlayback, seek, setVolume } = useAudio();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const scrubTimeRef = useRef(0);
  const scrubRecordSlugRef = useRef<string | null>(null);
  const scrubbingRef = useRef(false);
  const isPlayable = Boolean(activeRecord.playback);
  const status = !isPlayable ? "Unavailable" : error ? "Playback error · retry" : isLoading ? "Loading…" : isPlaying ? "Playing" : "Paused";
  const sourceDuration = duration || activeRecord.duration;
  const total = Number.isFinite(sourceDuration) ? Math.max(0, sourceDuration) : 0;
  const position = Number.isFinite(currentTime) ? Math.min(total, Math.max(0, currentTime)) : 0;
  const shownPosition = isScrubbing ? scrubTime : position;
  const canSeek = isPlayable && isReady && total > 0;
  const progress = total > 0 ? (shownPosition / total) * 100 : 0;
  const progressStyle = { "--deck-progress": `${progress}%` } as CSSProperties;
  const volumeStyle = { "--deck-volume": `${volume}%` } as CSSProperties;
  const volumeLabel = Math.round(volume).toString().padStart(2, "0");

  const previewSeek = (value: string) => {
    const next = Math.min(total, Math.max(0, Number(value)));
    if (!Number.isFinite(next)) return;
    scrubTimeRef.current = next;
    scrubRecordSlugRef.current = activeRecord.slug;
    scrubbingRef.current = true;
    setScrubTime(next);
    setIsScrubbing(true);
  };

  const commitSeek = () => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setIsScrubbing(false);
    if (scrubRecordSlugRef.current !== activeRecord.slug) return;
    seek(scrubTimeRef.current);
  };

  if (isUnlistedPath(pathname)) return null;

  return (
    <aside className={`lowkal-player lowkal-player--compact${isPlaying ? " is-playing" : ""}`} aria-label="Lowkal audio player">
      <div className="lowkal-player-art">
        <MediaFrame variant="record" src={activeRecord.artwork} alt="" fill sizes="56px" />
      </div>

      <button
        className="lowkal-player-transport"
        type="button"
        onClick={error ? retryPlayback : togglePlayback}
        aria-label={`${error ? "Retry" : isLoading ? "Cancel loading" : isPlaying ? "Pause" : "Play"} ${activeRecord.series} — ${activeRecord.title}`}
        aria-describedby="lowkal-playback-status"
        disabled={!isPlayable}
      >
        <span className="lowkal-player-transport-icon">
          {error ? <RotateCcw aria-hidden="true" /> : isPlaying || isLoading ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </span>
      </button>

      <div className="lowkal-player-program" aria-live="polite">
        <div className="lowkal-player-status">
          <span id="lowkal-playback-status" role="status" title={error ?? undefined}><i aria-hidden="true" /> {status}<span className="sr-only">{error ? `: ${error}` : ""}</span></span>
          <span>{activeRecord.format === "weekly" ? "Weekly volume" : "Programme set"}</span>
        </div>
        <div className="lowkal-player-title-row">
          <SiteLink className="lowkal-player-title" href={sitePath(activeRecord.artistSlugs[0] ? `/artists/${activeRecord.artistSlugs[0]}` : "/listen")}>{activeRecord.artist}</SiteLink>
          {activeRecord.youtubeVideoUrl ? (
            <a
              className="lowkal-player-video"
              href={activeRecord.youtubeVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Watch this mix on YouTube"
              title="Watch on YouTube"
            >
              <Video aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <span className="lowkal-player-record">{activeRecord.series} <i>/</i> {activeRecord.title}</span>
      </div>

      <label className="lowkal-player-timeline">
        <span className="sr-only">Playback position</span>
        <div className="lowkal-player-timecode" aria-hidden="true">
          <span>{formatTime(shownPosition)}</span>
          <span>Position</span>
          <span>{formatTime(total)}</span>
        </div>
        <span className="lowkal-player-track">
          <input
            type="range"
            min={0}
            max={Math.max(1, total)}
            step={1}
            value={shownPosition}
            aria-valuetext={`${formatTime(shownPosition)} of ${formatTime(total)}`}
            disabled={!canSeek}
            style={progressStyle}
            onChange={(event) => previewSeek(event.currentTarget.value)}
            onPointerUp={commitSeek}
            onPointerCancel={commitSeek}
            onBlur={commitSeek}
            onKeyUp={commitSeek}
          />
          <i aria-hidden="true" />
        </span>
      </label>

      <label className="lowkal-player-volume">
        <Volume2 aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-valuetext={`${Math.round(volume)} percent`}
          style={volumeStyle}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
        <output className="sr-only">Volume {volumeLabel}</output>
      </label>
      <SiteLink className="lowkal-player-room" href={sitePath("/listen")} aria-label="Open Soundroom">
        <ArrowUpRight aria-hidden="true" />
      </SiteLink>
    </aside>
  );
}