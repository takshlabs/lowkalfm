"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import WaveSurfer from "wavesurfer.js";
import { formatTime } from "@/lib/content";

type AudioWaveformProps = {
  sourceUrl?: string;
  currentTime: number;
  duration: number;
  canSeek: boolean;
  onSeek: (seconds: number) => void;
  className?: string;
};

const waveformOptions = {
  barWidth: 2,
  barGap: 1,
  barRadius: 3,
  barMinHeight: 1,
  cursorWidth: 1,
  cursorColor: "rgba(241, 234, 219, 0.82)",
  dragToSeek: false,
  interact: false,
  normalize: true,
  progressColor: "#f04437",
  sampleRate: 8_000,
  waveColor: "rgba(241, 234, 219, 0.26)"
} as const;

function boundedTime(time: number, duration: number) {
  if (!Number.isFinite(time) || !(duration > 0)) return 0;
  return Math.min(duration, Math.max(0, time));
}

export function AudioWaveform({ sourceUrl, currentTime, duration, canSeek, onSeek, className }: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<WaveSurfer | null>(null);
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const position = boundedTime(currentTime, total);
  const positionRef = useRef(position);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !sourceUrl || !total) return;

    container.dataset.state = "loading";
    const waveform = WaveSurfer.create({
      container,
      duration: total,
      height: 28,
      url: sourceUrl,
      ...waveformOptions
    });
    waveformRef.current = waveform;
    waveform.on("ready", () => {
      container.dataset.state = "ready";
      waveform.setTime(positionRef.current);
    });
    waveform.on("error", () => {
      container.dataset.state = "unavailable";
    });

    return () => {
      waveform.destroy();
      if (waveformRef.current === waveform) waveformRef.current = null;
    };
  }, [sourceUrl, total]);

  useEffect(() => {
    positionRef.current = position;
    waveformRef.current?.setTime(position);
  }, [position]);

  const seekFromPointer = (clientX: number) => {
    if (!canSeek || !total) return;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    onSeek(boundedTime(((clientX - bounds.left) / bounds.width) * total, total));
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    seekFromPointer(event.clientX);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canSeek || !total) return;
    const step = event.shiftKey ? 30 : 5;
    const target = event.key === "Home" ? 0
      : event.key === "End" ? total
        : event.key === "ArrowLeft" || event.key === "ArrowDown" ? position - step
          : event.key === "ArrowRight" || event.key === "ArrowUp" ? position + step
            : null;
    if (target === null) return;
    event.preventDefault();
    onSeek(boundedTime(target, total));
  };

  return (
    <div
      ref={containerRef}
      className={`audio-waveform${className ? ` ${className}` : ""}`}
      data-state={sourceUrl ? "loading" : "unavailable"}
      role="slider"
      tabIndex={canSeek ? 0 : -1}
      aria-label={sourceUrl ? "Playback waveform" : "Playback position"}
      aria-disabled={!canSeek}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={position}
      aria-valuetext={`${formatTime(position)} of ${formatTime(total)}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  );
}
