"use client";

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import {
  ArrowUpRight,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from "lucide-react";
import { MediaFrame } from "@/components/MediaFrame";
import { SiteLink } from "@/components/SiteLink";
import { formatTime } from "@/lib/content";
import { sitePath } from "@/lib/site-path";
import { usePathname } from "next/navigation";
import { useAudio } from "./AudioProvider";

export function PersistentPlayer() {
  const pathname = usePathname();
  const [isQueueOpen, setQueueOpen] = useState(false);
  const lastVolume = useRef(82);
  const {
    activeRecord,
    queue,
    currentTime,
    duration,
    isPlaying,
    isReady,
    isShuffled,
    isRepeat,
    volume,
    playRecord,
    togglePlayback,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    seek,
    setVolume
  } = useAudio();

  const total = duration || activeRecord.duration;
  const seekRatio = total > 0 ? Math.min(1, currentTime / total) : 0;
  const isMuted = volume === 0;

  const dockStyle = {
    "--seek": seekRatio,
    "--vol": `${volume}%`
  } as CSSProperties;

  const toggleMute = () => {
    if (isMuted) {
      setVolume(lastVolume.current || 82);
      return;
    }
    lastVolume.current = volume;
    setVolume(0);
  };

  if (pathname.startsWith(sitePath("/studio"))) return null;

  return (
    <aside
      className={`player${isPlaying ? " is-playing" : ""}`}
      style={dockStyle}
      aria-label="Lowkal audio player"
    >
      <label className="player__seek">
        <span className="sr-only">Playback position</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(total))}
          step={1}
          value={Math.min(Math.round(currentTime), Math.max(1, Math.round(total)))}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="player__seek-track" aria-hidden="true">
          <span className="player__seek-fill" />
        </span>
        <span className="player__seek-knob" aria-hidden="true" />
      </label>

      <div className="player__body">
        <div className="player__art">
          <MediaFrame variant="record" src={activeRecord.artwork} alt="" fill sizes="56px" />
        </div>

        <div className="player__transport">
          <button
            type="button"
            className="player__btn player__btn--prev"
            onClick={playPrevious}
            aria-label="Previous session"
          >
            <SkipBack aria-hidden="true" />
          </button>

          <button
            type="button"
            className="player__btn player__btn--play"
            onClick={togglePlayback}
            disabled={!isReady}
            aria-label={`${isPlaying ? "Pause" : "Play"} ${activeRecord.series}`}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="player__btn player__btn--next"
            onClick={playNext}
            aria-label="Next session"
          >
            <SkipForward aria-hidden="true" />
          </button>

          <button
            type="button"
            className="player__btn player__btn--shuffle"
            onClick={toggleShuffle}
            aria-pressed={isShuffled}
            aria-label="Shuffle the queue"
          >
            <Shuffle aria-hidden="true" />
          </button>

          <button
            type="button"
            className="player__btn player__btn--repeat"
            onClick={toggleRepeat}
            aria-pressed={isRepeat}
            aria-label="Repeat this session"
          >
            <Repeat aria-hidden="true" />
          </button>
        </div>

        <div className="player__now">
          <p className="player__status" aria-live="polite">
            <span className="meter" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {isPlaying ? "Playing" : "Ready"}
          </p>
          <SiteLink className="player__title" href={sitePath("/listen")}>
            {activeRecord.artist}
          </SiteLink>
          <span className="player__record">
            {activeRecord.series} <i>/</i> {activeRecord.title}
          </span>
        </div>

        <p className="player__time tnum">
          {formatTime(currentTime)} <em>/ {formatTime(total)}</em>
        </p>

        <div className="player__utility">
          <button
            type="button"
            className="player__btn"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>

          <label className="player__volume">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>

          <button
            type="button"
            className="player__btn"
            onClick={() => setQueueOpen((open) => !open)}
            aria-pressed={isQueueOpen}
            aria-label={`${isQueueOpen ? "Hide" : "Show"} the queue`}
          >
            <ListMusic aria-hidden="true" />
          </button>

          <SiteLink className="player__btn" href={sitePath("/listen")} aria-label="Open Soundroom">
            <ArrowUpRight aria-hidden="true" />
          </SiteLink>
        </div>
      </div>

      {isQueueOpen ? (
        <ul className="player__queue" aria-label="Play queue">
          {queue.map((record, index) => {
            const isCurrent = record.youtubeId === activeRecord.youtubeId;
            return (
              <li key={record.slug}>
                <button
                  type="button"
                  className="player__queue-item"
                  aria-current={isCurrent}
                  onClick={() => playRecord(record.slug)}
                >
                  <span className="player__queue-num">{String(index + 1).padStart(2, "0")}</span>
                  <span className="player__queue-art">
                    <MediaFrame variant="record" src={record.artwork} alt="" fill sizes="42px" />
                  </span>
                  <span className="player__queue-copy">
                    <strong>{record.artist}</strong>
                    <span>{record.series}</span>
                  </span>
                  <span className="player__queue-time tnum">{formatTime(record.duration)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </aside>
  );
}
