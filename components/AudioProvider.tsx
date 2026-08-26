"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { getSoundRecord, soundRecords, SoundRecord } from "@/lib/content";
import { YouTubeEngine } from "./YouTubeEngine";

const STORAGE_KEY = "lowkal.player.v1";

type SavedPlayerState = {
  slug: string;
  currentTime: number;
  volume: number;
  savedAt: number;
};

const AUDIO_SYNC_CHANNEL = "lowkal.audio.v1";

/**
 * The play queue. Several records point at the same recording, so the queue
 * keeps the first entry for each source and drops the duplicates. Without this
 * a listener would hear the same set twice in a row.
 */
export const playQueue: SoundRecord[] = soundRecords.filter(
  (record, index, records) => records.findIndex((item) => item.youtubeId === record.youtubeId) === index
);

type AudioCommand =
  | { action: "request-state" }
  | { action: "toggle" }
  | { action: "play" }
  | { action: "pause" }
  | { action: "seek"; seconds: number }
  | { action: "volume"; volume: number }
  | { action: "shuffle" }
  | { action: "repeat" }
  | { action: "select"; youtubeId: string; autoplay: boolean };

type AudioContextValue = {
  activeRecord: SoundRecord;
  queue: SoundRecord[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  isShuffled: boolean;
  isRepeat: boolean;
  volume: number;
  playRecord: (slug: string, autoplay?: boolean) => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
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

/** True when the visitor is typing, so a shortcut must not steal the key. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [activeSlug, setActiveSlug] = useState(soundRecords[0].slug);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(soundRecords[0].duration);
  const [volume, setVolumeState] = useState(82);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const resumeAtRef = useRef(0);
  const autoplayRef = useRef(false);
  const currentTimeRef = useRef(0);
  const stateRef = useRef({ activeSlug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat });
  const activeRecord = getSoundRecord(activeSlug) ?? soundRecords[0];

  useEffect(() => {
    stateRef.current = { activeSlug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat };
  }, [activeSlug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat]);

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

  const playRecord = useCallback((slug: string, shouldPlay = true) => {
    const record = getSoundRecord(slug);
    if (!record) return;
    if (slug === activeSlug && playerRef.current) {
      if (shouldPlay) playerRef.current.playVideo();
      return;
    }
    autoplayRef.current = shouldPlay;
    resumeAtRef.current = 0;
    setCurrentTime(0);
    setDuration(record.duration);
    setIsPlaying(false);
    setIsReady(false);
    setActiveSlug(slug);
  }, [activeSlug]);

  /** Steps through the queue. Shuffle picks any other entry at random. */
  const step = useCallback((direction: -1 | 1) => {
    if (playQueue.length === 0) return;
    const current = Math.max(0, playQueue.findIndex((record) => record.youtubeId === activeRecord.youtubeId));
    let next = (current + direction + playQueue.length) % playQueue.length;
    if (isShuffled && playQueue.length > 1) {
      do {
        next = Math.floor(Math.random() * playQueue.length);
      } while (next === current);
    }
    playRecord(playQueue[next].slug, true);
  }, [activeRecord.youtubeId, isShuffled, playRecord]);

  const playNext = useCallback(() => step(1), [step]);
  const playPrevious = useCallback(() => {
    // A press in the first few seconds moves back a set. Later it restarts.
    if (currentTimeRef.current > 5) {
      playerRef.current?.seekTo(0, true);
      setCurrentTime(0);
      return;
    }
    step(-1);
  }, [step]);

  const onStateChange = useCallback((event: YouTubeEvent) => {
    setIsPlaying(event.data === 1);
    if (event.data === 2 || event.data === 0) persist();
    if (event.data !== 0) return;

    if (isRepeat) {
      setCurrentTime(0);
      event.target.seekTo(0, true);
      event.target.playVideo();
      return;
    }

    step(1);
  }, [isRepeat, persist, step]);

  const togglePlayback = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }, [isPlaying]);

  const toggleShuffle = useCallback(() => setIsShuffled((value) => !value), []);
  const toggleRepeat = useCallback(() => setIsRepeat((value) => !value), []);

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
    navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevious());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) playerRef.current?.seekTo(details.seekTime, true);
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [activeRecord, playNext, playPrevious]);

  /* --- Keyboard control -----------------------------------------------------
     Shortcuts stay out of the way while the visitor types and never fire with
     a modifier held, so browser and screen-reader commands keep working.
     ------------------------------------------------------------------------ */
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case " ":
        case "k":
          event.preventDefault();
          togglePlayback();
          break;
        case "ArrowRight":
          event.preventDefault();
          seek(currentTimeRef.current + 15);
          break;
        case "ArrowLeft":
          event.preventDefault();
          seek(currentTimeRef.current - 15);
          break;
        case "n":
          playNext();
          break;
        case "p":
          playPrevious();
          break;
        case "s":
          toggleShuffle();
          break;
        case "r":
          toggleRepeat();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playNext, playPrevious, seek, toggleRepeat, toggleShuffle, togglePlayback]);

  const postState = useCallback(async (target?: Window) => {
    const snapshot = stateRef.current;
    let exactTime = snapshot.currentTime;
    let exactDuration = snapshot.duration;

    try {
      const playerTime = await playerRef.current?.getCurrentTime();
      const playerDuration = await playerRef.current?.getDuration();
      if (Number.isFinite(playerTime)) exactTime = playerTime;
      if (Number.isFinite(playerDuration) && playerDuration > 0) exactDuration = playerDuration;
    } catch {
      // The last observed values are sufficient during a transient player error.
    }

    const record = getSoundRecord(snapshot.activeSlug) ?? soundRecords[0];
    const message = {
      channel: AUDIO_SYNC_CHANNEL,
      type: "state",
      state: {
        slug: record.slug,
        youtubeId: record.youtubeId,
        currentTime: exactTime,
        duration: exactDuration || record.duration,
        isPlaying: snapshot.isPlaying,
        isReady: snapshot.isReady,
        volume: snapshot.volume,
        isShuffled: snapshot.isShuffled,
        isRepeat: snapshot.isRepeat
      }
    };

    if (target) {
      target.postMessage(message, window.location.origin);
      return;
    }

    for (let index = 0; index < window.frames.length; index += 1) {
      window.frames[index]?.postMessage(message, window.location.origin);
    }
  }, []);

  useEffect(() => {
    void postState();
  }, [activeSlug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat, postState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source === window) return;
      const data = event.data as { channel?: string; type?: string; command?: AudioCommand } | null;
      if (!data || data.channel !== AUDIO_SYNC_CHANNEL || data.type !== "command" || !data.command) return;

      const command = data.command;
      if (command.action === "request-state") {
        if (event.source && "postMessage" in event.source) void postState(event.source as Window);
        return;
      }
      if (command.action === "toggle") togglePlayback();
      if (command.action === "play") playerRef.current?.playVideo();
      if (command.action === "pause") playerRef.current?.pauseVideo();
      if (command.action === "seek" && Number.isFinite(command.seconds)) seek(command.seconds);
      if (command.action === "volume" && Number.isFinite(command.volume)) setVolume(command.volume);
      if (command.action === "shuffle") toggleShuffle();
      if (command.action === "repeat") toggleRepeat();
      if (command.action === "select") {
        const record = soundRecords.find((item) => item.youtubeId === command.youtubeId);
        if (record) playRecord(record.slug, command.autoplay);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [playRecord, postState, seek, setVolume, toggleRepeat, toggleShuffle, togglePlayback]);

  const value = useMemo<AudioContextValue>(() => ({
    activeRecord,
    queue: playQueue,
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
  }), [
    activeRecord,
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
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
      <YouTubeEngine
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
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
