"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SoundRecord } from "@/lib/content";
import { useListenContent } from "./ListenContentProvider";

const STORAGE_KEY = "lowkal.player.v1";
const PLAYBACK_INTENT_KEY = "lowkal.player.playback-intent.v1";
const AUDIO_SYNC_CHANNEL = "lowkal.audio.v1";
const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";

type SavedPlayerState = { slug: string; currentTime: number; volume: number; savedAt: number };
type AudioCommand =
  | { action: "request-state" } | { action: "toggle" } | { action: "play" } | { action: "pause" }
  | { action: "seek"; seconds: number } | { action: "volume"; volume: number }
  | { action: "shuffle" } | { action: "repeat" } | { action: "select"; slug: string; autoplay: boolean };
type AudioContextValue = {
  activeRecord: SoundRecord; currentTime: number; duration: number; isPlaying: boolean; isReady: boolean; volume: number;
  playRecord: (slug: string, autoplay?: boolean) => void; togglePlayback: () => void; seek: (seconds: number) => void; setVolume: (volume: number) => void;
};
type YouTubeStateEvent = { data: number };
type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YouTubeApi = {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onStateChange: (event: YouTubeStateEvent) => void;
      onError: () => void;
    };
  }) => YouTubePlayer;
};
type YouTubeWindow = Window & typeof globalThis & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

const AudioContext = createContext<AudioContextValue | null>(null);
let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  const scope = window as YouTubeWindow;
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = scope.onYouTubeIframeAPIReady;
    scope.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (scope.YT?.Player) resolve(scope.YT);
      else reject(new Error("YouTube player API did not initialize"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_API_URL}"]`);
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("YouTube player API failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = YOUTUBE_API_URL;
    script.async = true;
    script.addEventListener("error", () => reject(new Error("YouTube player API failed to load")), { once: true });
    document.head.append(script);
  });
  return youtubeApiPromise;
}

function isPlayable(record?: SoundRecord) {
  return Boolean(record?.audioUrl || record?.youtubeId);
}

function readSavedState(): SavedPlayerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPlayerState>;
    if (!parsed.slug) return null;
    return { slug: parsed.slug, currentTime: Number(parsed.currentTime) || 0, volume: Number.isFinite(parsed.volume) ? Math.min(100, Math.max(0, Number(parsed.volume))) : 82, savedAt: Number(parsed.savedAt) || Date.now() };
  } catch { return null; }
}

function readPlaybackIntent() {
  try { return window.sessionStorage.getItem(PLAYBACK_INTENT_KEY) === "playing"; } catch { return false; }
}

function savePlaybackIntent(shouldPlay: boolean) {
  try { window.sessionStorage.setItem(PLAYBACK_INTENT_KEY, shouldPlay ? "playing" : "paused"); } catch { /* Playback still works if storage is unavailable. */ }
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { records, getRecord } = useListenContent();
  const playableRecords = useMemo(() => records.filter((record) => record.showInPlayer && isPlayable(record)), [records]);
  const firstRecord = playableRecords[0] ?? records[0];
  const [activeSlug, setActiveSlug] = useState(firstRecord.slug);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(firstRecord.duration);
  const [volume, setVolumeState] = useState(82);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [failedAudioUrl, setFailedAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const resumeAtRef = useRef(0);
  const autoplayRef = useRef(typeof window !== "undefined" && readPlaybackIntent());
  const currentTimeRef = useRef(0);
  const volumeRef = useRef(volume);
  const onEndedRef = useRef<() => void>(() => undefined);
  const activeRecord = getRecord(activeSlug) ?? firstRecord;
  const useYouTube = Boolean(activeRecord.youtubeId && (!activeRecord.audioUrl || failedAudioUrl === activeRecord.audioUrl));
  const stateRef = useRef({ activeSlug: activeRecord.slug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat });

  useEffect(() => { stateRef.current = { activeSlug: activeRecord.slug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat }; }, [activeRecord.slug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat]);
  useEffect(() => {
    const saved = readSavedState();
    if (!saved || !getRecord(saved.slug)) return;
    resumeAtRef.current = saved.currentTime;
    // This client-only value is available only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSlug(saved.slug); setCurrentTime(saved.currentTime); setVolumeState(saved.volume); setDuration(getRecord(saved.slug)?.duration ?? 0);
  }, [getRecord]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const persist = useCallback((time = currentTimeRef.current) => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ slug: activeRecord.slug, currentTime: time, volume, savedAt: Date.now() } satisfies SavedPlayerState)); } catch { /* Playback still works if storage is unavailable. */ }
  }, [activeRecord.slug, volume]);
  useEffect(() => {
    const handlePageExit = () => persist();
    window.addEventListener("pagehide", handlePageExit);
    return () => window.removeEventListener("pagehide", handlePageExit);
  }, [persist]);

  const playMedia = useCallback(() => {
    if (!isPlayable(activeRecord)) return;
    savePlaybackIntent(true); autoplayRef.current = true;
    if (!useYouTube && activeRecord.audioUrl && audioRef.current) {
      void audioRef.current.play().catch(() => { setIsPlaying(false); savePlaybackIntent(false); });
      return;
    }
    youtubePlayerRef.current?.playVideo();
  }, [activeRecord, useYouTube]);
  const pauseMedia = useCallback(() => {
    savePlaybackIntent(false); autoplayRef.current = false;
    audioRef.current?.pause();
    youtubePlayerRef.current?.pauseVideo();
  }, []);

  const playRecord = useCallback((slug: string, shouldPlay = true) => {
    const record = getRecord(slug);
    if (!isPlayable(record)) return;
    if (slug === activeRecord.slug) { if (shouldPlay) playMedia(); else pauseMedia(); return; }
    savePlaybackIntent(shouldPlay); autoplayRef.current = shouldPlay; resumeAtRef.current = 0;
    setFailedAudioUrl(null); setCurrentTime(0); setDuration(record?.duration ?? 0); setIsPlaying(false); setIsReady(false); setActiveSlug(slug);
  }, [activeRecord.slug, getRecord, pauseMedia, playMedia]);

  const playNext = useCallback(() => {
    const available = playableRecords.filter((record, index, items) => items.findIndex((item) => item.slug === record.slug) === index);
    if (!available.length) return;
    const currentIndex = Math.max(0, available.findIndex((record) => record.slug === activeRecord.slug));
    let nextIndex = (currentIndex + 1) % available.length;
    if (isShuffled && available.length > 1) do { nextIndex = Math.floor(Math.random() * available.length); } while (nextIndex === currentIndex);
    playRecord(available[nextIndex].slug, true);
  }, [activeRecord.slug, isShuffled, playRecord, playableRecords]);

  const onEnded = useCallback(() => {
    persist();
    if (isRepeat) {
      resumeAtRef.current = 0;
      if (audioRef.current) audioRef.current.currentTime = 0;
      youtubePlayerRef.current?.seekTo(0, true);
      playMedia();
      return;
    }
    playNext();
  }, [isRepeat, persist, playMedia, playNext]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const onLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    if (resumeAtRef.current > 0) audio.currentTime = resumeAtRef.current;
    setDuration(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeRecord.duration);
    setIsReady(true);
    if (autoplayRef.current) playMedia();
  }, [activeRecord.duration, playMedia, volume]);

  useEffect(() => {
    if (!useYouTube || !activeRecord.youtubeId || !youtubeHostRef.current) return;
    let active = true;
    setIsReady(false);
    loadYouTubeApi().then((YT) => {
      if (!active || !youtubeHostRef.current) return;
      youtubePlayerRef.current = new YT.Player(youtubeHostRef.current, {
        videoId: activeRecord.youtubeId as string,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            if (!active) return;
            target.setVolume(volumeRef.current);
            if (resumeAtRef.current > 0) target.seekTo(resumeAtRef.current, true);
            const sourceDuration = target.getDuration();
            setDuration(sourceDuration > 0 ? sourceDuration : activeRecord.duration);
            setIsReady(true);
            if (autoplayRef.current) target.playVideo();
          },
          onStateChange: ({ data }) => {
            if (!active) return;
            setIsPlaying(data === 1);
            if (data === 0) onEndedRef.current();
          },
          onError: () => { if (active) { setIsReady(false); setIsPlaying(false); savePlaybackIntent(false); } }
        }
      });
    }).catch(() => { if (active) { setIsReady(false); setIsPlaying(false); } });
    return () => {
      active = false;
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [activeRecord.duration, activeRecord.slug, activeRecord.youtubeId, useYouTube]);

  useEffect(() => {
    if (!isPlaying || !useYouTube || !activeRecord.youtubeId) return;
    const timer = window.setInterval(() => {
      const nextTime = youtubePlayerRef.current?.getCurrentTime();
      const nextDuration = youtubePlayerRef.current?.getDuration();
      if (Number.isFinite(nextTime)) setCurrentTime(nextTime as number);
      if (Number.isFinite(nextDuration) && (nextDuration as number) > 0) setDuration(nextDuration as number);
    }, 500);
    return () => window.clearInterval(timer);
  }, [activeRecord.youtubeId, isPlaying, useYouTube]);

  const togglePlayback = useCallback(() => { if (isPlayable(activeRecord)) { if (isPlaying) pauseMedia(); else playMedia(); } }, [activeRecord, isPlaying, pauseMedia, playMedia]);
  const seek = useCallback((seconds: number) => {
    const bounded = Math.min(duration || activeRecord.duration, Math.max(0, seconds));
    setCurrentTime(bounded);
    if (audioRef.current) audioRef.current.currentTime = bounded;
    youtubePlayerRef.current?.seekTo(bounded, true);
    persist(bounded);
  }, [activeRecord.duration, duration, persist]);
  const setVolume = useCallback((nextVolume: number) => {
    const bounded = Math.min(100, Math.max(0, nextVolume));
    setVolumeState(bounded);
    if (audioRef.current) audioRef.current.volume = bounded / 100;
    youtubePlayerRef.current?.setVolume(bounded);
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: `${activeRecord.series} — ${activeRecord.title}`, artist: activeRecord.artist, album: "Lowkal Soundroom", artwork: [{ src: activeRecord.artwork, sizes: "512x512", type: "image/png" }] });
    navigator.mediaSession.setActionHandler("play", playMedia);
    navigator.mediaSession.setActionHandler("pause", pauseMedia);
    navigator.mediaSession.setActionHandler("seekto", (details) => { if (details.seekTime != null) seek(details.seekTime); });
    return () => { navigator.mediaSession.setActionHandler("play", null); navigator.mediaSession.setActionHandler("pause", null); navigator.mediaSession.setActionHandler("seekto", null); };
  }, [activeRecord, pauseMedia, playMedia, seek]);

  const postState = useCallback((target?: Window) => {
    const snapshot = stateRef.current;
    const audio = audioRef.current;
    const record = getRecord(snapshot.activeSlug) ?? firstRecord;
    const youtubeTime = youtubePlayerRef.current?.getCurrentTime();
    const youtubeDuration = youtubePlayerRef.current?.getDuration();
    const message = { channel: AUDIO_SYNC_CHANNEL, type: "state", state: { slug: record.slug, audioUrl: record.audioUrl, currentTime: audio?.currentTime ?? youtubeTime ?? snapshot.currentTime, duration: audio?.duration || youtubeDuration || snapshot.duration || record.duration, isPlaying: useYouTube ? snapshot.isPlaying : Boolean(audio && !audio.paused && !audio.ended), isReady: snapshot.isReady, volume: snapshot.volume, isShuffled: snapshot.isShuffled, isRepeat: snapshot.isRepeat } };
    if (target) { target.postMessage(message, window.location.origin); return; }
    for (let index = 0; index < window.frames.length; index += 1) window.frames[index]?.postMessage(message, window.location.origin);
  }, [firstRecord, getRecord, useYouTube]);
  useEffect(() => { postState(); }, [activeSlug, currentTime, duration, isPlaying, isReady, volume, isShuffled, isRepeat, postState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source === window) return;
      const data = event.data as { channel?: string; type?: string; command?: AudioCommand } | null;
      if (!data || data.channel !== AUDIO_SYNC_CHANNEL || data.type !== "command" || !data.command) return;
      const command = data.command;
      if (command.action === "request-state") { if (event.source && "postMessage" in event.source) postState(event.source as Window); return; }
      if (command.action === "toggle") togglePlayback();
      if (command.action === "play") playMedia();
      if (command.action === "pause") pauseMedia();
      if (command.action === "seek" && Number.isFinite(command.seconds)) seek(command.seconds);
      if (command.action === "volume" && Number.isFinite(command.volume)) setVolume(command.volume);
      if (command.action === "shuffle") setIsShuffled((value) => !value);
      if (command.action === "repeat") setIsRepeat((value) => !value);
      if (command.action === "select") playRecord(command.slug, command.autoplay);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pauseMedia, playMedia, playRecord, postState, seek, setVolume, togglePlayback]);

  const value = useMemo<AudioContextValue>(() => ({ activeRecord, currentTime, duration, isPlaying, isReady, volume, playRecord, togglePlayback, seek, setVolume }), [activeRecord, currentTime, duration, isPlaying, isReady, volume, playRecord, togglePlayback, seek, setVolume]);
  return (
    <AudioContext.Provider value={value}>
      {children}
      {!useYouTube && activeRecord.audioUrl ? (
        <audio key={activeRecord.slug} ref={audioRef} className="audio-engine" src={activeRecord.audioUrl} preload="metadata" onLoadedMetadata={onLoadedMetadata} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); persist(event.currentTarget.currentTime); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={onEnded} onError={() => { setIsReady(false); setIsPlaying(false); if (activeRecord.youtubeId) setFailedAudioUrl(activeRecord.audioUrl ?? null); }}>
          <track kind="captions" srcLang="en" label="No spoken content" src="data:text/vtt,WEBVTT" />
        </audio>
      ) : useYouTube && activeRecord.youtubeId ? (
        <div key={activeRecord.slug} className="youtube-audio-engine" aria-hidden="true"><div ref={youtubeHostRef} /></div>
      ) : null}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
