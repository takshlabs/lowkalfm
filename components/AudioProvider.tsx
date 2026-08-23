"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { getSoundRecord, soundRecords, SoundRecord } from "@/lib/content";

const STORAGE_KEY = "lowkal.player.v1";

type SavedPlayerState = {
  slug: string;
  currentTime: number;
  volume: number;
  savedAt: number;
};

type AudioContextValue = {
  activeRecord: SoundRecord;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  volume: number;
  playRecord: (slug: string) => void;
  togglePlayback: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
};

const AudioContext = createContext<AudioContextValue | null>(null);

function readSavedState(): SavedPlayerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPlayerState>;
    if (!parsed.slug || !getSoundRecord(parsed.slug)) return null;
    return {
      slug: parsed.slug,
      currentTime: Number(parsed.currentTime) || 0,
      volume: Number.isFinite(parsed.volume) ? Math.min(100, Math.max(0, Number(parsed.volume))) : 82,
      savedAt: Number(parsed.savedAt) || Date.now()
    };
  } catch {
    return null;
  }
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [activeSlug, setActiveSlug] = useState(soundRecords[0].slug);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(soundRecords[0].duration);
  const [volume, setVolumeState] = useState(82);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const resumeAtRef = useRef(0);
  const autoplayRef = useRef(false);
  const currentTimeRef = useRef(0);
  const activeRecord = getSoundRecord(activeSlug) ?? soundRecords[0];

  useEffect(() => {
    const saved = readSavedState();
    if (!saved) return;
    resumeAtRef.current = saved.currentTime;
    // This client-only value is available only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSlug(saved.slug);
    setCurrentTime(saved.currentTime);
    setVolumeState(saved.volume);
    setDuration(getSoundRecord(saved.slug)?.duration ?? 0);
  }, []);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const persist = useCallback((time = currentTimeRef.current) => {
    try {
      const state: SavedPlayerState = {
        slug: activeSlug,
        currentTime: time,
        volume,
        savedAt: Date.now()
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Playback still works if browser storage is unavailable.
    }
  }, [activeSlug, volume]);

  useEffect(() => {
    const handlePageExit = () => persist();
    window.addEventListener("pagehide", handlePageExit);
    return () => window.removeEventListener("pagehide", handlePageExit);
  }, [persist]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    const timer = window.setInterval(async () => {
      try {
        const time = await playerRef.current?.getCurrentTime();
        const nextDuration = await playerRef.current?.getDuration();
        if (Number.isFinite(time)) setCurrentTime(time);
        if (Number.isFinite(nextDuration) && nextDuration > 0) setDuration(nextDuration);
        if (Number.isFinite(time)) persist(time);
      } catch {
        // The next interval retries after transient player errors.
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isReady, persist]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${activeRecord.series} — ${activeRecord.title}`,
      artist: activeRecord.artist,
      album: "Lowkal Soundroom",
      artwork: [{ src: activeRecord.artwork, sizes: "512x512", type: "image/png" }]
    });
    navigator.mediaSession.setActionHandler("play", () => playerRef.current?.playVideo());
    navigator.mediaSession.setActionHandler("pause", () => playerRef.current?.pauseVideo());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) playerRef.current?.seekTo(details.seekTime, true);
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [activeRecord]);

  const onReady = useCallback((event: YouTubeEvent) => {
    playerRef.current = event.target;
    setIsReady(true);
    event.target.setVolume(volume);
    if (resumeAtRef.current > 0) event.target.seekTo(resumeAtRef.current, true);
    if (autoplayRef.current) {
      autoplayRef.current = false;
      event.target.playVideo();
    }
  }, [volume]);

  const onStateChange = useCallback((event: YouTubeEvent) => {
    setIsPlaying(event.data === 1);
    if (event.data === 2 || event.data === 0) persist();
  }, [persist]);

  const playRecord = useCallback((slug: string) => {
    const record = getSoundRecord(slug);
    if (!record) return;
    if (slug === activeSlug && playerRef.current) {
      playerRef.current.playVideo();
      return;
    }
    autoplayRef.current = true;
    resumeAtRef.current = 0;
    setCurrentTime(0);
    setDuration(record.duration);
    setIsReady(false);
    setActiveSlug(slug);
  }, [activeSlug]);

  const togglePlayback = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }, [isPlaying]);

  const seek = useCallback((seconds: number) => {
    const bounded = Math.min(duration || activeRecord.duration, Math.max(0, seconds));
    setCurrentTime(bounded);
    playerRef.current?.seekTo(bounded, true);
    persist(bounded);
  }, [activeRecord.duration, duration, persist]);

  const setVolume = useCallback((nextVolume: number) => {
    const bounded = Math.min(100, Math.max(0, nextVolume));
    setVolumeState(bounded);
    playerRef.current?.setVolume(bounded);
  }, []);

  const value = useMemo<AudioContextValue>(() => ({
    activeRecord,
    currentTime,
    duration,
    isPlaying,
    isReady,
    volume,
    playRecord,
    togglePlayback,
    seek,
    setVolume
  }), [activeRecord, currentTime, duration, isPlaying, isReady, volume, playRecord, togglePlayback, seek, setVolume]);

  return (
    <AudioContext.Provider value={value}>
      {children}
      <div className="youtube-engine" aria-hidden="true">
        <YouTube
          key={activeRecord.slug}
          videoId={activeRecord.youtubeId}
          onReady={onReady}
          onStateChange={onStateChange}
          opts={{
            width: "1",
            height: "1",
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              playsinline: 1,
              rel: 0
            }
          }}
        />
      </div>
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
