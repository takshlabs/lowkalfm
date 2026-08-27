"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { getSoundRecord, soundRecords, SoundRecord } from "@/lib/content";

const STORAGE_KEY = "lowkal.player.v1";
const PLAYBACK_INTENT_KEY = "lowkal.player.playback-intent.v1";

type SavedPlayerState = {
  slug: string;
  currentTime: number;
  volume: number;
  savedAt: number;
};

const AUDIO_SYNC_CHANNEL = "lowkal.audio.v1";

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
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  volume: number;
  playRecord: (slug: string, autoplay?: boolean) => void;
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

function readPlaybackIntent() {
  try {
    return window.sessionStorage.getItem(PLAYBACK_INTENT_KEY) === "playing";
  } catch {
    return false;
  }
}

function savePlaybackIntent(shouldPlay: boolean) {
  try {
    window.sessionStorage.setItem(PLAYBACK_INTENT_KEY, shouldPlay ? "playing" : "paused");
  } catch {
    // Playback still works if browser storage is unavailable.
  }
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
  const autoplayRef = useRef(typeof window !== "undefined" && readPlaybackIntent());
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

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${activeRecord.series} — ${activeRecord.title}`,
      artist: activeRecord.artist,
      album: "Lowkal Soundroom",
      artwork: [{ src: activeRecord.artwork, sizes: "512x512", type: "image/png" }]
    });
    navigator.mediaSession.setActionHandler("play", () => {
      savePlaybackIntent(true);
      autoplayRef.current = true;
      playerRef.current?.playVideo();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      savePlaybackIntent(false);
      autoplayRef.current = false;
      playerRef.current?.pauseVideo();
    });
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
    } else {
      event.target.pauseVideo();
    }
  }, [volume]);

  const playRecord = useCallback((slug: string, shouldPlay = true) => {
    const record = getSoundRecord(slug);
    if (!record) return;
    if (slug === activeSlug && playerRef.current) {
      savePlaybackIntent(shouldPlay);
      autoplayRef.current = shouldPlay;
      if (shouldPlay) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
      return;
    }
    savePlaybackIntent(shouldPlay);
    autoplayRef.current = shouldPlay;
    resumeAtRef.current = 0;
    setCurrentTime(0);
    setDuration(record.duration);
    setIsPlaying(false);
    setIsReady(false);
    setActiveSlug(slug);
  }, [activeSlug]);

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

    const playableRecords = soundRecords.filter((record, index, records) => (
      records.findIndex((item) => item.youtubeId === record.youtubeId) === index
    ));
    const currentIndex = Math.max(0, playableRecords.findIndex((record) => record.youtubeId === activeRecord.youtubeId));
    let nextIndex = (currentIndex + 1) % playableRecords.length;
    if (isShuffled && playableRecords.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * playableRecords.length);
      } while (nextIndex === currentIndex);
    }
    playRecord(playableRecords[nextIndex].slug, true);
  }, [activeRecord.youtubeId, isRepeat, isShuffled, persist, playRecord]);

  const togglePlayback = useCallback(() => {
    if (!playerRef.current) return;
    const shouldPlay = !isPlaying;
    savePlaybackIntent(shouldPlay);
    autoplayRef.current = shouldPlay;
    if (shouldPlay) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
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
      if (command.action === "play") {
        savePlaybackIntent(true);
        autoplayRef.current = true;
        playerRef.current?.playVideo();
      }
      if (command.action === "pause") {
        savePlaybackIntent(false);
        autoplayRef.current = false;
        playerRef.current?.pauseVideo();
      }
      if (command.action === "seek" && Number.isFinite(command.seconds)) seek(command.seconds);
      if (command.action === "volume" && Number.isFinite(command.volume)) setVolume(command.volume);
      if (command.action === "shuffle") setIsShuffled((value) => !value);
      if (command.action === "repeat") setIsRepeat((value) => !value);
      if (command.action === "select") {
        const record = soundRecords.find((item) => item.youtubeId === command.youtubeId);
        if (record) playRecord(record.slug, command.autoplay);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [playRecord, postState, seek, setVolume, togglePlayback]);

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
