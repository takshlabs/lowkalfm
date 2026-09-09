"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SoundRecord } from "@/lib/content";
import { boundPlaybackTime, createPlaybackRequests } from "@/lib/audio-playback";
import { createAudioAnalysis, isAnalysisSource, startAnalysisBridge, startMixerBridge } from "@/lib/audio-analysis";
import { sitePath } from "@/lib/site-path";
import { useListenContent } from "./ListenContentProvider";

const STORAGE_KEY = "lowkal.player.v1";
const AUDIO_SYNC_CHANNEL = "lowkal.audio.v1";
const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";

type SavedPlayerState = { slug: string; currentTime: number; volume: number; savedAt: number };
type AudioCommand =
  | { action: "request-state" } | { action: "toggle" } | { action: "play" } | { action: "pause" } | { action: "retry" }
  | { action: "seek"; seconds: number } | { action: "seek-by"; seconds: number } | { action: "volume"; volume: number }
  | { action: "shuffle" } | { action: "repeat" } | { action: "select"; slug: string; autoplay: boolean };
type AudioContextValue = {
  isLoading: boolean; error: string | null; retryPlayback: () => void;
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

function needsNativeBackgroundAudio() {
  const hasTouchScreen = navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const shortestScreenEdge = Math.min(window.screen.width, window.screen.height);
  return hasCoarsePointer || (hasTouchScreen && shortestScreenEdge <= 1024);
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

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { records, getRecord } = useListenContent();
  const playableRecords = useMemo(() => records.filter((record) => isPlayable(record)), [records]);
  const firstRecord = playableRecords[0] ?? records[0];
  const [activeSlug, setActiveSlug] = useState(firstRecord.slug);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(firstRecord.duration);
  const [volume, setVolumeState] = useState(82);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const requestsRef = useRef(createPlaybackRequests());
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [failedAudioUrl, setFailedAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analysisRef = useRef<ReturnType<typeof createAudioAnalysis> | null>(null);
  const analysisMounted = useRef(false);
  const getAnalysis = useCallback(() => {
    analysisRef.current ??= createAudioAnalysis(() => new window.AudioContext(), window.location.origin);
    return analysisRef.current;
  }, []);
  const bindAudio = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
    getAnalysis().setElement(audio);
  }, [getAnalysis]);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const resumeAtRef = useRef(firstRecord.startOffset ?? 0);
  const autoplayRef = useRef(false);
  const currentTimeRef = useRef(0);
  const volumeRef = useRef(volume);
  const onEndedRef = useRef<() => void>(() => undefined);
  const activeRecord = getRecord(activeSlug) ?? firstRecord;
  const useYouTube = Boolean(activeRecord.youtubeId && (!activeRecord.audioUrl || failedAudioUrl === activeRecord.audioUrl));
  const stateRef = useRef({ activeSlug: activeRecord.slug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isShuffled, isRepeat });

  useEffect(() => {
    analysisMounted.current = true;
    const stop = startAnalysisBridge(window, () => getAnalysis().read(), () => {
      const audio = audioRef.current;
      return Boolean(audio && !audio.paused && !audio.ended && audio.readyState >= 2);
    }, sitePath("/soundroom/index.html"));
    const stopMixer = startMixerBridge(window, getAnalysis(), sitePath("/soundroom/index.html"));
    return () => {
      stop();
      stopMixer();
      analysisMounted.current = false;
      // React Strict Mode replays effects and refs. Do not close its live graph.
      queueMicrotask(() => {
        if (!analysisMounted.current) {
          analysisRef.current?.dispose();
          analysisRef.current = null;
        }
      });
    };
  }, [getAnalysis]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeRecord.audioUrl || useYouTube) return;
    // Apply CORS before src. Other hosts retain normal, non-CORS playback.
    if (isAnalysisSource(activeRecord.audioUrl, window.location.origin)) audio.crossOrigin = "anonymous";
    else audio.removeAttribute("crossorigin");
    if (audio.getAttribute("src") !== activeRecord.audioUrl) audio.src = activeRecord.audioUrl;
  }, [activeRecord.audioUrl, activeRecord.slug, useYouTube]);

  useEffect(() => { stateRef.current = { activeSlug: activeRecord.slug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isShuffled, isRepeat }; }, [activeRecord.slug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isShuffled, isRepeat]);
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
    const request = requestsRef.current.begin();
    setError(null); setIsLoading(true);
    autoplayRef.current = true;
    if (!useYouTube && activeRecord.audioUrl && audioRef.current) {
      const audio = audioRef.current;
      if (audio.ended) audio.currentTime = activeRecord.startOffset ?? 0;
      if (!audio.paused && !audio.ended && audio.readyState >= 3) { setIsLoading(false); setIsPlaying(true); return; }
      // A MediaElementAudioSourceNode can be suspended with its AudioContext
      // when a phone backgrounds the browser. Keep the native media path on
      // touch devices so playback and system media controls remain available.
      if (!needsNativeBackgroundAudio()) getAnalysis().activate();
      void audio.play().catch(() => {
        if (!requestsRef.current.isCurrent(request) || audioRef.current !== audio) return;
        setIsPlaying(false); setIsLoading(false); autoplayRef.current = false;
        setError("Audio could not start. Press retry to play.");
      });
      return;
    }
    youtubePlayerRef.current?.playVideo?.();
  }, [activeRecord, getAnalysis, useYouTube]);
  const pauseMedia = useCallback(() => {
    requestsRef.current.cancel();
    autoplayRef.current = false;
    setIsLoading(false); setIsPlaying(false);
    audioRef.current?.pause();
    youtubePlayerRef.current?.pauseVideo?.();
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      pauseMedia();
      setError("Audio is taking too long to load. Check your connection and retry.");
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [isLoading, activeRecord.slug, currentTime, pauseMedia]);

  const retryPlayback = useCallback(() => {
    requestsRef.current.cancel();
    setError(null); setIsLoading(true); setIsReady(false);
    autoplayRef.current = true;
    resumeAtRef.current = currentTimeRef.current;
    if (useYouTube) {
      youtubeApiPromise = null;
      if (!(window as YouTubeWindow).YT?.Player) document.querySelector(`script[src="${YOUTUBE_API_URL}"]`)?.remove();
      setRetryKey((value) => value + 1);
    } else {
      audioRef.current?.load();
      playMedia();
    }
  }, [playMedia, useYouTube]);

  const playRecord = useCallback((slug: string, shouldPlay = true) => {
    const record = getRecord(slug);
    if (!isPlayable(record)) return;
    if (slug === activeRecord.slug) { if (shouldPlay) playMedia(); else pauseMedia(); return; }
    requestsRef.current.cancel();
    audioRef.current?.pause();
    youtubePlayerRef.current?.pauseVideo?.();
    setError(null); setIsLoading(shouldPlay);
    if (shouldPlay && record?.audioUrl && !needsNativeBackgroundAudio()) getAnalysis().activate(record.audioUrl);
    autoplayRef.current = shouldPlay; resumeAtRef.current = record?.startOffset ?? 0;
    setFailedAudioUrl(null); setCurrentTime(0); setDuration(record?.duration ?? 0); setIsPlaying(false); setIsReady(false); setActiveSlug(slug);
  }, [activeRecord.slug, getAnalysis, getRecord, pauseMedia, playMedia]);

  const playNext = useCallback(() => {
    const available = playableRecords.filter((record, index, items) => items.findIndex((item) => item.slug === record.slug) === index);
    if (!available.length) return;
    const currentIndex = Math.max(0, available.findIndex((record) => record.slug === activeRecord.slug));
    let nextIndex = (currentIndex + 1) % available.length;
    if (isShuffled && available.length > 1) do { nextIndex = Math.floor(Math.random() * available.length); } while (nextIndex === currentIndex);
    playRecord(available[nextIndex].slug, true);
  }, [activeRecord.slug, isShuffled, playRecord, playableRecords]);

  const playPrevious = useCallback(() => {
    const available = playableRecords.filter((record, index, items) => items.findIndex((item) => item.slug === record.slug) === index);
    if (!available.length) return;
    const currentIndex = Math.max(0, available.findIndex((record) => record.slug === activeRecord.slug));
    playRecord(available[(currentIndex - 1 + available.length) % available.length].slug, true);
  }, [activeRecord.slug, playRecord, playableRecords]);

  const onEnded = useCallback(() => {
    persist();
    if (isRepeat) {
      resumeAtRef.current = activeRecord.startOffset ?? 0;
      if (audioRef.current) audioRef.current.currentTime = activeRecord.startOffset ?? 0;
      youtubePlayerRef.current?.seekTo?.(activeRecord.startOffset ?? 0, true);
      playMedia();
      return;
    }
    playNext();
  }, [activeRecord.startOffset, isRepeat, persist, playMedia, playNext]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const onLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    const startTime = boundPlaybackTime(resumeAtRef.current, audio.duration) ?? 0;
    audio.currentTime = startTime;
    setCurrentTime(startTime);
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
            const startTime = boundPlaybackTime(resumeAtRef.current, target.getDuration()) ?? 0;
            if (startTime > 0) target.seekTo(startTime, true);
            const sourceDuration = target.getDuration();
            setDuration(sourceDuration > 0 ? sourceDuration : activeRecord.duration);
            setIsReady(true);
            if (autoplayRef.current) target.playVideo();
          },
          onStateChange: ({ data }) => {
            if (!active) return;
            setIsPlaying(data === 1);
            setIsLoading(data === 3 && autoplayRef.current);
            if (data === 1) { setError(null); if (!autoplayRef.current) youtubePlayerRef.current?.pauseVideo?.(); }
            if (data === 0) onEndedRef.current();
          },
          onError: () => { if (active) { setIsReady(false); setIsPlaying(false); setIsLoading(false); setError("This video could not play. Try again."); autoplayRef.current = false; } }
        }
      });
    }).catch(() => { if (active) { setIsReady(false); setIsPlaying(false); setIsLoading(false); setError("The video player could not load. Try again."); autoplayRef.current = false; } });
    return () => {
      active = false;
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [activeRecord.duration, activeRecord.slug, activeRecord.startOffset, activeRecord.youtubeId, useYouTube, retryKey]);

  useEffect(() => {
    if (!isPlaying || !useYouTube || !activeRecord.youtubeId) return;
    const timer = window.setInterval(() => {
      const nextTime = youtubePlayerRef.current?.getCurrentTime?.();
      const nextDuration = youtubePlayerRef.current?.getDuration?.();
      if (Number.isFinite(nextTime)) setCurrentTime(nextTime as number);
      if (Number.isFinite(nextDuration) && (nextDuration as number) > 0) setDuration(nextDuration as number);
    }, 500);
    return () => window.clearInterval(timer);
  }, [activeRecord.youtubeId, isPlaying, useYouTube]);

  const togglePlayback = useCallback(() => { if (isPlayable(activeRecord)) { if (autoplayRef.current) pauseMedia(); else if (error) retryPlayback(); else playMedia(); } }, [activeRecord, error, pauseMedia, playMedia, retryPlayback]);
  const seek = useCallback((seconds: number) => {
    const bounded = boundPlaybackTime(seconds, duration || activeRecord.duration);
    if (bounded === null) return;
    resumeAtRef.current = bounded;
    currentTimeRef.current = bounded;
    setCurrentTime(bounded);
    if (audioRef.current && audioRef.current.readyState >= 1) audioRef.current.currentTime = bounded;
    youtubePlayerRef.current?.seekTo?.(bounded, true);
    persist(bounded);
  }, [activeRecord.duration, duration, persist]);
  const seekBy = useCallback((seconds: number) => {
    const mediaTime = audioRef.current?.currentTime ?? youtubePlayerRef.current?.getCurrentTime?.() ?? currentTimeRef.current;
    seek(mediaTime + seconds);
  }, [seek]);
  const setVolume = useCallback((nextVolume: number) => {
    if (!Number.isFinite(nextVolume)) return;
    const bounded = Math.min(100, Math.max(0, nextVolume));
    setVolumeState(bounded);
    if (audioRef.current) audioRef.current.volume = bounded / 100;
    youtubePlayerRef.current?.setVolume?.(bounded);
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const artwork = new URL(activeRecord.artwork, window.location.origin).href;
    session.metadata = new MediaMetadata({
      title: activeRecord.title,
      artist: activeRecord.artist,
      album: `${activeRecord.series} · Lowkal Soundroom`,
      artwork: [{ src: artwork, sizes: "512x512" }]
    });
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: playMedia,
      pause: pauseMedia,
      stop: () => { pauseMedia(); seek(activeRecord.startOffset ?? 0); },
      previoustrack: playPrevious,
      nexttrack: playNext,
      seekbackward: (details) => seekBy(-(details.seekOffset ?? 10)),
      seekforward: (details) => seekBy(details.seekOffset ?? 30),
      seekto: (details) => { if (details.seekTime != null) seek(details.seekTime); }
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { session.setActionHandler(action as MediaSessionAction, handler); }
      catch { /* Each phone exposes a different subset of media actions. */ }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try { session.setActionHandler(action as MediaSessionAction, null); }
        catch { /* Ignore unsupported actions during cleanup. */ }
      }
    };
  }, [activeRecord.artist, activeRecord.artwork, activeRecord.series, activeRecord.startOffset, activeRecord.title, pauseMedia, playMedia, playNext, playPrevious, seek, seekBy]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.playbackState = isPlaying ? "playing" : "paused";
    const total = duration || activeRecord.duration;
    if (!(total > 0) || !Number.isFinite(total)) return;
    try {
      session.setPositionState({ duration: total, playbackRate: 1, position: Math.min(total, Math.max(0, currentTime)) });
    } catch { /* Position state is optional on older mobile browsers. */ }
  }, [activeRecord.duration, currentTime, duration, isPlaying]);

  useEffect(() => {
    const preserveBackgroundPlayback = () => {
      if (!document.hidden || !isPlaying) return;
      persist();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    };
    document.addEventListener("visibilitychange", preserveBackgroundPlayback);
    return () => document.removeEventListener("visibilitychange", preserveBackgroundPlayback);
  }, [isPlaying, persist]);

  const postState = useCallback((target?: Window) => {
    const snapshot = stateRef.current;
    const audio = audioRef.current;
    const record = getRecord(snapshot.activeSlug) ?? firstRecord;
    const youtubeTime = youtubePlayerRef.current?.getCurrentTime?.();
    const youtubeDuration = youtubePlayerRef.current?.getDuration?.();
    const message = { channel: AUDIO_SYNC_CHANNEL, type: "state", state: { slug: record.slug, audioUrl: record.audioUrl, currentTime: audio?.currentTime ?? youtubeTime ?? snapshot.currentTime, duration: audio?.duration || youtubeDuration || snapshot.duration || record.duration, isPlaying: snapshot.isPlaying, isReady: snapshot.isReady, isLoading: snapshot.isLoading, error: snapshot.error, volume: snapshot.volume, isShuffled: snapshot.isShuffled, isRepeat: snapshot.isRepeat } };
    if (target) { target.postMessage(message, window.location.origin); return; }
    for (let index = 0; index < window.frames.length; index += 1) window.frames[index]?.postMessage(message, window.location.origin);
  }, [firstRecord, getRecord]);
  useEffect(() => { postState(); }, [activeSlug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isShuffled, isRepeat, postState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source === window) return;
      const data = event.data as { channel?: string; type?: string; command?: AudioCommand } | null;
      if (!data || data.channel !== AUDIO_SYNC_CHANNEL || data.type !== "command" || !data.command) return;
      const command = data.command;
      if (command.action === "request-state") { if (event.source && "postMessage" in event.source) postState(event.source as Window); return; }
      if (command.action === "toggle") togglePlayback();
      if (command.action === "play") playMedia();
      if (command.action === "retry") retryPlayback();
      if (command.action === "pause") pauseMedia();
      if (command.action === "seek" && Number.isFinite(command.seconds)) seek(command.seconds);
      if (command.action === "seek-by" && Number.isFinite(command.seconds)) seekBy(command.seconds);
      if (command.action === "volume" && Number.isFinite(command.volume)) setVolume(command.volume);
      if (command.action === "shuffle") setIsShuffled((value) => !value);
      if (command.action === "repeat") setIsRepeat((value) => !value);
      if (command.action === "select") playRecord(command.slug, command.autoplay);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pauseMedia, playMedia, playRecord, postState, retryPlayback, seek, seekBy, setVolume, togglePlayback]);

  const value = useMemo<AudioContextValue>(() => ({ activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, retryPlayback, volume, playRecord, togglePlayback, seek, setVolume }), [activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, retryPlayback, volume, playRecord, togglePlayback, seek, setVolume]);
  return (
    <AudioContext.Provider value={value}>
      {children}
      {!useYouTube && activeRecord.audioUrl ? (
        <audio key={`${activeRecord.slug}:${activeRecord.audioUrl}`} ref={bindAudio} className="audio-engine" preload="auto" onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={(event) => { currentTimeRef.current = event.currentTarget.currentTime; setCurrentTime(event.currentTarget.currentTime); persist(event.currentTarget.currentTime); }}
          onPlaying={(event) => { if (!autoplayRef.current) { event.currentTarget.pause(); return; } setIsPlaying(true); setIsLoading(false); setError(null); }}
          onWaiting={() => { if (autoplayRef.current) setIsLoading(true); }}
          onPause={() => setIsPlaying(false)} onEnded={onEnded}
          onError={() => { requestsRef.current.cancel(); setIsReady(false); setIsPlaying(false); if (activeRecord.youtubeId) { setFailedAudioUrl(activeRecord.audioUrl ?? null); setIsLoading(autoplayRef.current); } else { autoplayRef.current = false; setIsLoading(false); setError("Audio could not load. Check your connection and retry."); } }}>
          <track kind="captions" srcLang="en" label="No spoken content" src="data:text/vtt,WEBVTT" />
        </audio>
      ) : useYouTube && activeRecord.youtubeId ? (
        <div key={`${activeRecord.slug}:${retryKey}`} className="youtube-audio-engine" aria-hidden="true"><div ref={youtubeHostRef} /></div>
      ) : null}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
