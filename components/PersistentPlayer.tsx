"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, FastForward, Pause, Play, Repeat, Repeat1, Rewind, RotateCcw, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Timer, Video, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { formatTime } from "@/lib/content";
import { isUnlistedPath } from "@/lib/site-chrome";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";
import { MediaFrame } from "./MediaFrame";
import { useAudio } from "./AudioProvider";

const sleepOptions = [15, 30, 45, 60, "end"] as const;

export function PersistentPlayer() {
  const pathname = usePathname();
  const {
    activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, retryPlayback, volume, isMuted,
    isShuffled, repeatMode, sleepTimer, togglePlayback, playNext, playPrevious, seek, seekBy, setVolume,
    toggleMuted, toggleShuffle, cycleRepeatMode, setSleepTimer,
  } = useAudio();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const scrubTimeRef = useRef(0);
  const scrubbingRef = useRef(false);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : Math.max(0, activeRecord.duration ?? 0);
  const safeCurrentTime = Number.isFinite(currentTime) ? Math.min(safeDuration, Math.max(0, currentTime)) : 0;
  const shownTime = isScrubbing ? scrubTime : safeCurrentTime;
  const hasPlayableSource = Boolean(activeRecord.playback);
  const canSeek = hasPlayableSource && isReady && safeDuration > 0;
  const artistHref = activeRecord.artistSlugs[0] ? sitePath(`/artists/${activeRecord.artistSlugs[0]}`) : null;
  const disabled = !hasPlayableSource;
  const primaryLabel = !hasPlayableSource ? "Mix unavailable" : error ? "Retry playback" : isLoading ? "Stop loading" : isPlaying ? "Pause mix" : "Play mix";
  const sleepLabel = sleepTimer === "end" ? "end of mix" : sleepTimer ? `${sleepTimer} min` : "off";

  const previewSeek = (value: string) => {
    const next = Math.min(safeDuration, Math.max(0, Number(value)));
    if (!Number.isFinite(next)) return;
    scrubTimeRef.current = next;
    scrubbingRef.current = true;
    setScrubTime(next);
    setIsScrubbing(true);
  };
  const commitSeek = () => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    setIsScrubbing(false);
    seek(scrubTimeRef.current);
  };

  if (isUnlistedPath(pathname)) return null;

  return (
    <aside className={`lowkal-player${isExpanded ? " is-expanded" : ""}`} aria-label="Now playing">
      {isExpanded ? (
        <section className="lowkal-player-options" aria-label="Playback options">
          <div className="lowkal-player-options-heading">
            <span><SlidersHorizontal size={16} aria-hidden="true" /> Playback options</span>
            <button type="button" onClick={() => setIsExpanded(false)} aria-label="Close playback options"><ChevronDown size={18} aria-hidden="true" /></button>
          </div>
          <div className="lowkal-player-mode-row">
            <button type="button" aria-pressed={isShuffled} onClick={toggleShuffle}><Shuffle size={17} aria-hidden="true" /> Shuffle</button>
            <button type="button" aria-pressed={repeatMode !== "off"} onClick={cycleRepeatMode}>
              {repeatMode === "one" ? <Repeat1 size={17} aria-hidden="true" /> : <Repeat size={17} aria-hidden="true" />}
              Repeat {repeatMode}
            </button>
            <button type="button" aria-pressed={isMuted} onClick={toggleMuted}>
              {isMuted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
              {isMuted ? "Unmute" : "Mute"}
            </button>
          </div>
          <label className="lowkal-player-volume">
            <span>Volume</span>
            <input type="range" min="0" max="100" value={volume} aria-label="Volume" aria-valuetext={`${volume} percent`} onChange={(event) => setVolume(Number(event.currentTarget.value))} />
            <span>{volume}</span>
          </label>
          <div className="lowkal-player-sleep">
            <p><Timer size={16} aria-hidden="true" /> Sleep timer · {sleepLabel}</p>
            <div>
              {sleepOptions.map((option) => (
                <button key={option} type="button" aria-pressed={sleepTimer === option} onClick={() => setSleepTimer(sleepTimer === option ? null : option)}>
                  {option === "end" ? "End of mix" : `${option} min`}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="lowkal-player-art"><MediaFrame variant="record" src={activeRecord.artwork} alt={`${activeRecord.artist} artwork`} fill sizes="72px" priority /></div>
      <div className="lowkal-player-now">
        <p>{activeRecord.series}</p>
        <strong>{activeRecord.title}</strong>
        {artistHref ? <Link href={artistHref}>{activeRecord.artist}</Link> : <span>{activeRecord.artist}</span>}
        <div className="lowkal-player-timeline">
          <span>{formatTime(shownTime)}</span>
          <input type="range" min="0" max={safeDuration || 1} value={shownTime} disabled={!canSeek} aria-label="Seek mix" aria-valuetext={`${formatTime(shownTime)} of ${formatTime(safeDuration)}`}
            onChange={(event) => previewSeek(event.currentTarget.value)} onPointerUp={commitSeek} onPointerCancel={commitSeek} onBlur={commitSeek} onKeyUp={commitSeek} />
          <span>{formatTime(safeDuration)}</span>
        </div>
        {!hasPlayableSource ? <p className="lowkal-player-status" role="status">Unavailable</p> : error ? <p className="lowkal-player-status is-error" role="status">{error}</p> : isLoading ? <p className="lowkal-player-status" role="status">Loading mix…</p> : null}
      </div>

      <div className="lowkal-player-controls" aria-label="Playback controls">
        <button type="button" onClick={playPrevious} disabled={disabled} aria-label="Previous mix"><SkipBack size={17} aria-hidden="true" /></button>
        <button type="button" onClick={() => seekBy(-10)} disabled={!canSeek} aria-label="Back 10 seconds"><Rewind size={17} aria-hidden="true" /></button>
        <button className={`lowkal-player-transport${isLoading ? " is-loading" : ""}`} type="button" onClick={error ? retryPlayback : togglePlayback} disabled={disabled} aria-label={primaryLabel}>
          {error ? <RotateCcw size={20} aria-hidden="true" /> : isPlaying || isLoading ? <Pause size={21} aria-hidden="true" /> : <Play size={21} fill="currentColor" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => seekBy(30)} disabled={!canSeek} aria-label="Forward 30 seconds"><FastForward size={17} aria-hidden="true" /></button>
        <button type="button" onClick={playNext} disabled={disabled} aria-label="Next mix"><SkipForward size={17} aria-hidden="true" /></button>
      </div>
      <div className="lowkal-player-quick-tools">
        {activeRecord.youtubeVideoUrl ? (
          <a href={activeRecord.youtubeVideoUrl} target="_blank" rel="noopener noreferrer" aria-label="Watch this mix on YouTube" title="Watch on YouTube"><Video size={18} aria-hidden="true" /></a>
        ) : null}
        <button type="button" onClick={toggleMuted} aria-label={isMuted ? "Unmute" : "Mute"} aria-pressed={isMuted}>{isMuted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}</button>
        <button type="button" onClick={() => setIsExpanded((current) => !current)} aria-label={isExpanded ? "Close playback options" : "Open playback options"} aria-expanded={isExpanded}>
          {isExpanded ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
        </button>
        <Link href={sitePath("/listen")} aria-label="Open Soundroom">Room</Link>
      </div>
    </aside>
  );
}