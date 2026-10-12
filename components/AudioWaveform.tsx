"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { createSpectrumWaveform } from "@/lib/waveform-renderer";
import { formatTime } from "@/lib/content";

type AudioWaveformProps = {
  peaksUrl?: string;
  currentTime: number;
  duration: number;
  canSeek: boolean;
  onSeek: (seconds: number) => void;
  className?: string;
  compact?: boolean;
};

function boundedTime(time: number, duration: number) {
  if (!Number.isFinite(time) || !(duration > 0)) return 0;
  return Math.min(duration, Math.max(0, time));
}

export function AudioWaveform({ peaksUrl, currentTime, duration, canSeek, onSeek, className, compact = true }: AudioWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<ReturnType<typeof createSpectrumWaveform> | null>(null);
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const position = boundedTime(currentTime, total);
  const positionRef = useRef(position);

  const controlRef = useRef({ canSeek, onSeek });
  useEffect(() => { controlRef.current = { canSeek, onSeek }; }, [canSeek, onSeek]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const waveform = createSpectrumWaveform(container, {
      compact, duration: total,
      canSeek: () => controlRef.current.canSeek,
      onSeek: seconds => controlRef.current.onSeek(seconds)
    });
    waveformRef.current = waveform;
    waveform.setTime(positionRef.current);
    container.dataset.state = peaksUrl && total ? "loading" : "unavailable";
    const controller = new AbortController();
    if (peaksUrl && total) {
      void fetch(peaksUrl, { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error("Waveform data unavailable"); return response.json(); })
        .then(payload => { if (!controller.signal.aborted) waveform.setData(payload); })
        .catch(() => { if (!controller.signal.aborted) container.dataset.state = "unavailable"; });
    }
    return () => { controller.abort(); waveform.destroy(); if (waveformRef.current === waveform) waveformRef.current = null; };
  }, [peaksUrl, total, compact]);

  useEffect(() => {
    positionRef.current = position;
    waveformRef.current?.setTime(position);
  }, [position]);

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
      data-state={peaksUrl ? "loading" : "unavailable"}
      role="slider"
      tabIndex={canSeek ? 0 : -1}
      aria-label={peaksUrl ? "Playback waveform" : "Playback position"}
      aria-disabled={!canSeek}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={position}
      aria-valuetext={`${formatTime(position)} of ${formatTime(total)}`}
      onKeyDown={handleKeyDown}
    />
  );
}
