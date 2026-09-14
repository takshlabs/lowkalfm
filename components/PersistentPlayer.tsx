"use client";

import { useState, type CSSProperties } from "react";
import { LoaderCircle, Minus, Pause, Play, Plus, RotateCcw, Video, Volume2 } from "lucide-react";
import { AudioWaveform } from "@/components/AudioWaveform";
import { usePathname } from "next/navigation";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { formatTime } from "@/lib/content";
import { isUnlistedPath } from "@/lib/site-chrome";
import { sitePath } from "@/lib/site-path";
import { useAudio } from "./AudioProvider";

export function PersistentPlayer() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, volume, togglePlayback, retryPlayback, seek, setVolume } = useAudio();
  const isPlayable = Boolean(activeRecord.playback);
  const status = !isPlayable ? "Unavailable" : error ? "Playback error · retry" : isLoading ? "Loading…" : isPlaying ? "Playing" : "Paused";
  const sourceDuration = duration || activeRecord.duration;
  const total = Number.isFinite(sourceDuration) ? Math.max(0, sourceDuration) : 0;
  const position = Number.isFinite(currentTime) ? Math.min(total, Math.max(0, currentTime)) : 0;
  const shownPosition = position;
  const canSeek = isPlayable && isReady && total > 0;
  const volumeStyle = { "--deck-volume": `${volume}%` } as CSSProperties;
  const volumeLabel = Math.round(volume).toString().padStart(2, "0");
  const waveformPeaksUrl = activeRecord.playback?.provider === "cloudflare" ? activeRecord.waveformPeaksUrl : undefined;

  if (isUnlistedPath(pathname)) return null;

  return (
    <aside
      className={`lowkal-floating-deck lowkal-player lowkal-player--compact${isExpanded ? " is-expanded" : " is-mini"}${isPlaying ? " is-playing" : ""}`}
      aria-label="Lowkal audio player"
    >
      {/* Coveo-inspired Floating Mini Player */}
      <div className="lowkal-coveo-mini">
        <div className="coveo-track-info">
          <div
            className="coveo-status-label lowkal-player-status"
            data-state={isLoading ? "loading" : isPlaying ? "playing" : error ? "error" : "paused"}
          >
            <span role="status" title={error ?? undefined}>
              {status === "Playing" ? "PREVIEWING" : status.toUpperCase()}
              <span className="sr-only">{error ? `: ${error}` : ""}</span>
            </span>
          </div>
          <SiteLink
            className="coveo-track-title"
            title={activeRecord.title || activeRecord.artist}
            href={sitePath(activeRecord.artistSlugs[0] ? `/artists/${activeRecord.artistSlugs[0]}` : "/listen")}
          >
            {activeRecord.title || activeRecord.artist}
          </SiteLink>
        </div>

        <div className="coveo-record-container">
          <SiteLink
            className="coveo-record-offset"
            href={sitePath("/listen")}
            aria-label={`Open Soundroom for ${activeRecord.series} — ${activeRecord.title}`}
            title="Open Soundroom"
          >
            <div className="coveo-record" aria-hidden="true">
              <div className="coveo-record-artwork">
                <MediaFrame variant="record" src={activeRecord.artwork} alt="" fill sizes="90px" sourceWidth={180} />
              </div>
              <div className="coveo-spindle-outer" />
              <div className="coveo-spindle-inner" />
            </div>
          </SiteLink>
        </div>

        <div className="coveo-track-controls">
          <p className="coveo-timecode" aria-hidden="true">
            <span>{formatTime(shownPosition)}</span>
            <span className="coveo-time-sep">/</span>
            <span>{formatTime(total)}</span>
          </p>

          <button
            className="coveo-audio-button lowkal-player-transport"
            type="button"
            onClick={error ? retryPlayback : togglePlayback}
            aria-label={`${error ? "Retry" : isLoading ? "Cancel loading" : isPlaying ? "Pause" : "Play"} ${activeRecord.series} — ${activeRecord.title}`}
            aria-describedby="lowkal-playback-status"
            disabled={!isPlayable}
          >
            <div className="coveo-bars" aria-hidden="true">
              <div className="coveo-bar" />
              <div className="coveo-bar" />
              <div className="coveo-bar" />
              <div className="coveo-bar" />
            </div>
            <div className="coveo-audio-state">
              <span className={`lowkal-player-transport-icon${isLoading ? " is-loading" : ""}`}>
                {error ? (
                  <RotateCcw className="lowkal-icon" aria-hidden="true" />
                ) : isLoading ? (
                  <LoaderCircle className="lowkal-icon" aria-hidden="true" />
                ) : isPlaying ? (
                  <Pause className="lowkal-icon" aria-hidden="true" />
                ) : (
                  <Play className="lowkal-icon" aria-hidden="true" />
                )}
              </span>
            </div>
          </button>

          <button
            className="coveo-expand-button"
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand player"
            title="Expand player"
          >
            <Plus className="lowkal-icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Expanded Player (Wider production deck with coherent Coveo aesthetics) */}
      <div className="lowkal-coveo-expanded" aria-label="Expanded audio deck">
        <div className="lowkal-player-art">
          <MediaFrame variant="record" src={activeRecord.artwork} alt="" fill sizes="60px" sourceWidth={168} />
        </div>

        <button
          className="lowkal-player-transport"
          type="button"
          onClick={error ? retryPlayback : togglePlayback}
          aria-label={`${error ? "Retry" : isLoading ? "Cancel loading" : isPlaying ? "Pause" : "Play"} ${activeRecord.series} — ${activeRecord.title}`}
          aria-describedby="lowkal-playback-status"
          disabled={!isPlayable}
        >
          <span className={`lowkal-player-transport-icon${isLoading ? " is-loading" : ""}`}>
            {error ? (
              <RotateCcw className="lowkal-icon" aria-hidden="true" />
            ) : isLoading ? (
              <LoaderCircle className="lowkal-icon" aria-hidden="true" />
            ) : isPlaying ? (
              <Pause className="lowkal-icon" aria-hidden="true" />
            ) : (
              <Play className="lowkal-icon" aria-hidden="true" />
            )}
          </span>
        </button>

        <div className="lowkal-player-program" aria-live="polite">
          <div className="lowkal-player-status" data-state={isLoading ? "loading" : isPlaying ? "playing" : error ? "error" : "paused"}>
            <span id="lowkal-playback-status" role="status" title={error ?? undefined}>
              <i aria-hidden="true" /> {status}
              <span className="sr-only">{error ? `: ${error}` : ""}</span>
            </span>
          </div>
          <div className="lowkal-player-title-row">
            <SiteLink className="lowkal-player-title" title={activeRecord.artist} href={sitePath(activeRecord.artistSlugs[0] ? `/artists/${activeRecord.artistSlugs[0]}` : "/listen")}>
              {activeRecord.artist}
            </SiteLink>
            {activeRecord.youtubeVideoUrl ? (
              <a
                className="lowkal-player-video"
                href={activeRecord.youtubeVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Watch this mix on YouTube"
                title="Watch on YouTube"
              >
                <Video className="lowkal-icon" aria-hidden="true" />
              </a>
            ) : null}
          </div>
          <span className="lowkal-player-record" title={`${activeRecord.series} / ${activeRecord.title}`}>
            {activeRecord.series} <i>/</i> {activeRecord.title}
          </span>
        </div>

        <div className="lowkal-player-timeline">
          <span className="sr-only">Playback position</span>
          <div className="lowkal-player-timecode" aria-hidden="true">
            <span>{formatTime(shownPosition)}</span>
            <span>Position</span>
            <span>{formatTime(total)}</span>
          </div>
          <span className="lowkal-player-track">
            <AudioWaveform
              peaksUrl={waveformPeaksUrl}
              currentTime={shownPosition}
              duration={total}
              canSeek={canSeek}
              deck
              onSeek={seek}
            />
          </span>
        </div>

        <label className="lowkal-player-volume">
          <Volume2 className="lowkal-icon" aria-hidden="true" />
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
        <button className="lowkal-player-volume-toggle" type="button" popoverTarget="player-volume-panel" aria-label="Adjust volume" title="Volume">
          <Volume2 className="lowkal-icon" aria-hidden="true" />
        </button>
        <div id="player-volume-panel" className="lowkal-player-volume-panel" popover="auto">
          <label className="lowkal-player-volume-expanded">
            <Volume2 className="lowkal-icon" aria-hidden="true" />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              style={volumeStyle}
              aria-valuetext={`${Math.round(volume)} percent`}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
        </div>

        <SiteLink className="lowkal-player-room" href={sitePath("/listen")} aria-label="Open Soundroom" title="Open Soundroom">
          <Plus className="lowkal-icon" aria-hidden="true" />
        </SiteLink>

        <button
          className="lowkal-player-collapse"
          type="button"
          onClick={() => setIsExpanded(false)}
          aria-label="Collapse player"
          title="Collapse player"
        >
          <Minus className="lowkal-icon" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

