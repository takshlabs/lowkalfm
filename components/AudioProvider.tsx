"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SoundRecord } from "@/lib/content";
import { boundPlaybackTime, comparePlaybackClaims, createPlaybackRequests, createShuffleOrder, endedQueueIndex, nextQueueIndex, PLAYBACK_ACTIVITY_STORAGE_KEY, PLAYBACK_CLAIM_STORAGE_KEY, previousQueueIndex, shouldRestartPrevious, type PlaybackClaim, type RepeatMode } from "@/lib/audio-playback";
import { createAudioAnalysis, isAnalysisSource, startAnalysisBridge, startMixerBridge } from "@/lib/audio-analysis";
import { sitePath } from "@/lib/site-path";
import { useListenContent } from "./ListenContentProvider";

const STORAGE_KEY = "lowkal.player.v1";
const AUDIO_SYNC_CHANNEL = "lowkal.audio.v1";
const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";

type SleepTimer = 15 | 30 | 45 | 60 | "end" | null;
type SavedPlayerState = { slug: string; currentTime: number; volume: number; muted: boolean; shuffled: boolean; repeatMode: RepeatMode; sleepTimer: SleepTimer; sleepDeadline: number | null; savedAt: number };
type SavedPlayerOverrides = Partial<Pick<SavedPlayerState, "volume" | "muted" | "shuffled" | "repeatMode" | "sleepTimer" | "sleepDeadline">>;
type AudioCommand =
  | { action: "request-state" } | { action: "toggle" } | { action: "play" } | { action: "pause" } | { action: "retry" }
  | { action: "seek"; seconds: number } | { action: "seek-by"; seconds: number } | { action: "volume"; volume: number }
  | { action: "mute" } | { action: "next" } | { action: "previous" }
  | { action: "shuffle" } | { action: "repeat" } | { action: "sleep"; timer: SleepTimer } | { action: "select"; slug: string; autoplay: boolean };
type AudioContextValue = {
  isLoading: boolean; error: string | null; retryPlayback: () => void;
  activeRecord: SoundRecord; currentTime: number; duration: number; isPlaying: boolean; isReady: boolean; volume: number; isMuted: boolean;
  isShuffled: boolean; repeatMode: RepeatMode; sleepTimer: SleepTimer; sleepTimerMinutes: number | null; isExternalMediaPlaying: boolean;
  playRecord: (slug: string, autoplay?: boolean) => void; togglePlayback: () => void; playNext: () => void; playPrevious: () => void;
  seek: (seconds: number) => void; seekBy: (seconds: number) => void; setVolume: (volume: number) => void; toggleMuted: () => void;
  toggleShuffle: () => void; cycleRepeatMode: () => void; setSleepTimer: (timer: SleepTimer) => void;
};
type YouTubeStateEvent = { data: number };
type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
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
  return Boolean(record?.playback);
}

function playbackSourceKey(record?: SoundRecord) {
  const source = record?.playback;
  if (!record || !source) return `${record?.slug ?? "none"}:unavailable`;
  return source.provider === "cloudflare"
    ? `${record.slug}:cloudflare:${source.url}`
    : `${record.slug}:youtube:${source.videoId}`;
}

function needsNativeBackgroundAudio() {
  const hasTouchScreen = navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const shortestScreenEdge = Math.min(window.screen.width, window.screen.height);
  return hasCoarsePointer || (hasTouchScreen && shortestScreenEdge <= 1024);
}

function isSoundroomFrameSource(source: MessageEventSource | null) {
  const soundroomPath = new URL(sitePath("/soundroom/index.html"), window.location.origin).pathname;
  return [...document.querySelectorAll<HTMLIFrameElement>("iframe")].some((frame) => {
    if (frame.contentWindow !== source) return false;
    const frameUrl = new URL(frame.src, window.location.href);
    return frameUrl.origin === window.location.origin && frameUrl.pathname === soundroomPath;
  });
}

function readSavedState(): SavedPlayerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPlayerState>;
    if (!parsed.slug) return null;
    const repeatMode = parsed.repeatMode === "all" || parsed.repeatMode === "one" ? parsed.repeatMode : "off";
    const sleepTimer = parsed.sleepTimer === 15 || parsed.sleepTimer === 30 || parsed.sleepTimer === 45 || parsed.sleepTimer === 60 || parsed.sleepTimer === "end" ? parsed.sleepTimer : null;
    const sleepDeadline = Number.isFinite(parsed.sleepDeadline) && Number(parsed.sleepDeadline) > Date.now() ? Number(parsed.sleepDeadline) : null;
    return { slug: parsed.slug, currentTime: Number(parsed.currentTime) || 0, volume: Number.isFinite(parsed.volume) ? Math.min(100, Math.max(0, Number(parsed.volume))) : 82, muted: Boolean(parsed.muted), shuffled: Boolean(parsed.shuffled), repeatMode, sleepTimer, sleepDeadline, savedAt: Number(parsed.savedAt) || Date.now() };
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
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isMuted, setIsMuted] = useState(false);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimer>(null);
  const [isExternalMediaPlaying, setIsExternalMediaPlaying] = useState(false);
  const sleepDeadlineRef = useRef<number | null>(null);
  const externalMediaRef = useRef(new Set<HTMLMediaElement>());
  const lastPersistAtRef = useRef(0);
  const tabIdRef = useRef("");
  const claimSequenceRef = useRef(0);
  const ownerClaimRef = useRef<PlaybackClaim | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
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
  const youtubeSessionRef = useRef(0);
  const youtubeFailureRef = useRef<string | null>(null);
  const resumeAtRef = useRef(firstRecord.startOffset ?? 0);
  const sourceKeyRef = useRef(playbackSourceKey(firstRecord));
  const pendingSeekRef = useRef<{ sourceKey: string; position: number; expiresAt: number } | null>(null);
  const autoplayRef = useRef(false);
  const currentTimeRef = useRef(0);
  const volumeRef = useRef(volume);
  const onEndedRef = useRef<() => void>(() => undefined);
  const stateRevisionRef = useRef(0);
  const didRestoreRef = useRef(false);
  const activeRecord = getRecord(activeSlug) ?? firstRecord;
  const playback = activeRecord.playback;
  const cloudflareUrl = playback?.provider === "cloudflare" ? playback.url : undefined;
  const youtubeId = playback?.provider === "youtube" ? playback.videoId : undefined;
  const isYouTubeSource = playback?.provider === "youtube";
  const activeSourceKey = playbackSourceKey(activeRecord);
  const canonicalQueue = useMemo(() => playableRecords.filter((record, index, items) => items.findIndex((item) => item.slug === record.slug) === index).map((record) => record.slug), [playableRecords]);
  const [queueOrder, setQueueOrder] = useState(() => canonicalQueue);
  const activeQueue = useMemo(() => isShuffled
    ? [...queueOrder.filter((slug) => canonicalQueue.includes(slug)), ...canonicalQueue.filter((slug) => !queueOrder.includes(slug))]
    : canonicalQueue, [canonicalQueue, isShuffled, queueOrder]);
  const stateRef = useRef({ activeSlug: activeRecord.slug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isMuted, isShuffled, repeatMode, sleepTimer });

  const isCurrentNativeEvent = useCallback((audio: HTMLAudioElement, sourceKey: string) => audioRef.current === audio && sourceKeyRef.current === sourceKey, []);
  const acceptProviderPosition = useCallback((sourceKey: string, nextTime: number) => {
    if (sourceKeyRef.current !== sourceKey) return null;
    if (!Number.isFinite(nextTime)) return null;
    const pending = pendingSeekRef.current;
    if (pending?.sourceKey === sourceKey) {
      // Ignore stale progress from the old timeline until the provider reaches
      // the requested seek target. A media event can arrive more than half a
      // second after an accepted seek, especially after backgrounding, so use
      // a one-second settle window and a finite recovery window.
      if (Math.abs(nextTime - pending.position) > 1 && Date.now() < pending.expiresAt) return null;
      pendingSeekRef.current = null;
    }
    return nextTime;
  }, []);

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
    if (!audio || !cloudflareUrl) return;
    // Apply CORS before src. Other hosts retain normal, non-CORS playback.
    if (isAnalysisSource(cloudflareUrl, window.location.origin)) audio.crossOrigin = "anonymous";
    else audio.removeAttribute("crossorigin");
    if (audio.getAttribute("src") !== cloudflareUrl) audio.src = cloudflareUrl;
  }, [activeRecord.slug, cloudflareUrl]);

  useEffect(() => {
    sourceKeyRef.current = activeSourceKey;
  }, [activeSourceKey]);

  useEffect(() => { stateRef.current = { activeSlug: activeRecord.slug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isMuted, isShuffled, repeatMode, sleepTimer }; }, [activeRecord.slug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isMuted, isShuffled, repeatMode, sleepTimer]);
  useEffect(() => {
    if (didRestoreRef.current) return;
    const saved = readSavedState();
    if (!saved) { didRestoreRef.current = true; return; }
    // The initial fallback catalog can arrive before Sanity. Keep the saved
    // intent pending until its record exists instead of permanently skipping it.
    if (!getRecord(saved.slug)) return;
    didRestoreRef.current = true;
    resumeAtRef.current = saved.currentTime;
    // This client-only value is available only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSlug(saved.slug); setCurrentTime(saved.currentTime); setVolumeState(saved.volume); setIsMuted(saved.muted); setIsShuffled(saved.shuffled); setQueueOrder(saved.shuffled ? createShuffleOrder(canonicalQueue, saved.slug) : canonicalQueue); setRepeatMode(saved.repeatMode); setDuration(getRecord(saved.slug)?.duration ?? 0);
    if (saved.sleepTimer === "end" || saved.sleepDeadline !== null) {
      sleepDeadlineRef.current = saved.sleepDeadline;
      setSleepTimerState(saved.sleepTimer);
    }
  }, [canonicalQueue, getRecord]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const ensureTabId = useCallback(() => {
    if (!tabIdRef.current) tabIdRef.current = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    return tabIdRef.current;
  }, []);

  const persist = useCallback((time = currentTimeRef.current, overrides: SavedPlayerOverrides = {}) => {
    if (ownerClaimRef.current && ownerClaimRef.current.tabId !== ensureTabId()) return;
    try {
      const hasOverride = (key: keyof SavedPlayerOverrides) => Object.prototype.hasOwnProperty.call(overrides, key);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        slug: activeRecord.slug,
        currentTime: time,
        volume: overrides.volume ?? volume,
        muted: overrides.muted ?? isMuted,
        shuffled: overrides.shuffled ?? isShuffled,
        repeatMode: overrides.repeatMode ?? repeatMode,
        sleepTimer: hasOverride("sleepTimer") ? overrides.sleepTimer ?? null : sleepTimer,
        sleepDeadline: hasOverride("sleepDeadline") ? overrides.sleepDeadline ?? null : sleepDeadlineRef.current,
        savedAt: Date.now()
      } satisfies SavedPlayerState));
    } catch { /* Playback still works if storage is unavailable. */ }
  }, [activeRecord.slug, ensureTabId, isMuted, isShuffled, repeatMode, sleepTimer, volume]);
  const persistThrottled = useCallback((time: number) => {
    const now = Date.now();
    if (now - lastPersistAtRef.current < 5000) return;
    lastPersistAtRef.current = now;
    persist(time);
  }, [persist]);
  useEffect(() => {
    const handlePageExit = () => persist();
    window.addEventListener("pagehide", handlePageExit);
    return () => window.removeEventListener("pagehide", handlePageExit);
  }, [persist]);

  const claimPlayback = useCallback(() => {
    const claim: PlaybackClaim = { timestamp: Date.now(), sequence: ++claimSequenceRef.current, tabId: ensureTabId() };
    ownerClaimRef.current = claim;
    broadcastRef.current?.postMessage({ type: "play-claim", claim });
    try { window.localStorage.setItem(PLAYBACK_CLAIM_STORAGE_KEY, JSON.stringify(claim)); } catch { /* BroadcastChannel remains the primary transport. */ }
  }, [ensureTabId]);
  const pauseExternalMedia = useCallback(() => {
    const externalMedia = [...externalMediaRef.current];
    externalMediaRef.current.clear();
    setIsExternalMediaPlaying(false);
    externalMedia.forEach((media) => media.pause());
  }, []);

  const playMedia = useCallback(() => {
    if (!isPlayable(activeRecord)) return;
    if (navigator.onLine === false) {
      setIsLoading(false);
      setError("You are offline. Reconnect to stream this mix.");
      return;
    }
    const request = requestsRef.current.begin();
    setError(null); setIsLoading(true);
    autoplayRef.current = true;
    pauseExternalMedia();
    claimPlayback();
    if (cloudflareUrl && audioRef.current) {
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
    if (youtubeFailureRef.current) {
      setIsLoading(false);
      setError(youtubeFailureRef.current);
      autoplayRef.current = false;
      return;
    }
    youtubePlayerRef.current?.playVideo?.();
  }, [activeRecord, claimPlayback, cloudflareUrl, getAnalysis, pauseExternalMedia]);
  const pauseMedia = useCallback(() => {
    requestsRef.current.cancel();
    autoplayRef.current = false;
    setIsLoading(false); setIsPlaying(false);
    audioRef.current?.pause();
    youtubePlayerRef.current?.pauseVideo?.();
  }, []);

  useEffect(() => {
    const stopTracking = (media: HTMLMediaElement) => {
      externalMediaRef.current.delete(media);
      setIsExternalMediaPlaying(externalMediaRef.current.size > 0);
    };
    const handleExternalPlay = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement) || media === audioRef.current) return;
      externalMediaRef.current.add(media);
      setIsExternalMediaPlaying(true);
      media.addEventListener("pause", () => stopTracking(media), { once: true });
      media.addEventListener("ended", () => stopTracking(media), { once: true });
      pauseMedia();
    };
    document.addEventListener("play", handleExternalPlay, true);
    return () => document.removeEventListener("play", handleExternalPlay, true);
  }, [pauseMedia]);

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
    if (isYouTubeSource) {
      youtubeFailureRef.current = null;
      youtubeApiPromise = null;
      if (!(window as YouTubeWindow).YT?.Player) document.querySelector(`script[src="${YOUTUBE_API_URL}"]`)?.remove();
      setRetryKey((value) => value + 1);
    } else {
      // `load()` resets a native element to the beginning. Wait for metadata so
      // `onLoadedMetadata` restores resumeAtRef before any new `play()` call.
      audioRef.current?.load();
    }
  }, [isYouTubeSource]);

  const playRecord = useCallback((slug: string, shouldPlay = true) => {
    const record = getRecord(slug);
    if (!isPlayable(record)) return;
    if (slug === activeRecord.slug) { if (shouldPlay) playMedia(); else pauseMedia(); return; }
    requestsRef.current.cancel();
    sourceKeyRef.current = playbackSourceKey(record);
    pendingSeekRef.current = null;
    audioRef.current?.pause();
    youtubePlayerRef.current?.pauseVideo?.();
    setError(null); setIsLoading(shouldPlay);
    youtubeFailureRef.current = null;
    if (shouldPlay && record?.playback?.provider === "cloudflare" && !needsNativeBackgroundAudio()) getAnalysis().activate(record.playback.url);
    autoplayRef.current = shouldPlay; resumeAtRef.current = record?.startOffset ?? 0;
    setCurrentTime(0); setDuration(record?.duration ?? 0); setIsPlaying(false); setIsReady(false); setActiveSlug(slug);
  }, [activeRecord.slug, getAnalysis, getRecord, pauseMedia, playMedia]);

  const playNext = useCallback(() => {
    const currentIndex = activeQueue.indexOf(activeRecord.slug);
    const nextIndex = nextQueueIndex(currentIndex, activeQueue.length, repeatMode === "one" ? "off" : repeatMode);
    if (nextIndex === null) { pauseMedia(); return; }
    playRecord(activeQueue[nextIndex], true);
  }, [activeQueue, activeRecord.slug, pauseMedia, playRecord, repeatMode]);

  const playPrevious = useCallback(() => {
    if (shouldRestartPrevious(currentTimeRef.current, activeRecord.startOffset ?? 0)) {
      resumeAtRef.current = activeRecord.startOffset ?? 0;
      if (audioRef.current) audioRef.current.currentTime = activeRecord.startOffset ?? 0;
      youtubePlayerRef.current?.seekTo?.(activeRecord.startOffset ?? 0, true);
      setCurrentTime(activeRecord.startOffset ?? 0);
      return;
    }
    const currentIndex = activeQueue.indexOf(activeRecord.slug);
    const previousIndex = previousQueueIndex(currentIndex, activeQueue.length, repeatMode === "one" ? "off" : repeatMode);
    if (previousIndex === null) {
      const start = activeRecord.startOffset ?? 0;
      resumeAtRef.current = start;
      currentTimeRef.current = start;
      setCurrentTime(start);
      if (audioRef.current) audioRef.current.currentTime = start;
      youtubePlayerRef.current?.seekTo?.(start, true);
      persist(start);
      return;
    }
    playRecord(activeQueue[previousIndex], true);
  }, [activeQueue, activeRecord.slug, activeRecord.startOffset, persist, playRecord, repeatMode]);

  const onEnded = useCallback(() => {
    persist();
    if (sleepTimer === "end") {
      sleepDeadlineRef.current = null;
      setSleepTimerState(null);
      persist(currentTimeRef.current, { sleepTimer: null, sleepDeadline: null });
      pauseMedia();
      return;
    }
    const currentIndex = activeQueue.indexOf(activeRecord.slug);
    const nextIndex = endedQueueIndex(currentIndex, activeQueue.length, repeatMode);
    if (nextIndex === null) { pauseMedia(); return; }
    if (nextIndex === currentIndex) {
      resumeAtRef.current = activeRecord.startOffset ?? 0;
      if (audioRef.current) audioRef.current.currentTime = activeRecord.startOffset ?? 0;
      youtubePlayerRef.current?.seekTo?.(activeRecord.startOffset ?? 0, true);
      playMedia();
      return;
    }
    playRecord(activeQueue[nextIndex], true);
  }, [activeQueue, activeRecord.slug, activeRecord.startOffset, pauseMedia, persist, playMedia, playRecord, repeatMode, sleepTimer]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const onLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    if (!isCurrentNativeEvent(audio, activeSourceKey)) return;
    audio.volume = volume / 100;
    audio.muted = isMuted;
    const startTime = boundPlaybackTime(resumeAtRef.current, audio.duration) ?? 0;
    pendingSeekRef.current = { sourceKey: activeSourceKey, position: startTime, expiresAt: Date.now() + 2_000 };
    audio.currentTime = startTime;
    setCurrentTime(startTime);
    setDuration(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeRecord.duration);
    setIsReady(true);
    if (autoplayRef.current) playMedia();
  }, [activeRecord.duration, activeSourceKey, isCurrentNativeEvent, isMuted, playMedia, volume]);

  useEffect(() => {
    if (!isYouTubeSource || !youtubeId || !youtubeHostRef.current) return;
    let active = true;
    const session = ++youtubeSessionRef.current;
    const ownsCurrentSession = () => active && youtubeSessionRef.current === session && sourceKeyRef.current === activeSourceKey;
    setIsReady(false);
    loadYouTubeApi().then((YT) => {
      if (!active || !youtubeHostRef.current) return;
      youtubePlayerRef.current = new YT.Player(youtubeHostRef.current, {
        videoId: youtubeId,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            if (!ownsCurrentSession()) return;
            youtubeFailureRef.current = null;
            target.setVolume(volumeRef.current);
            if (stateRef.current.isMuted) target.mute(); else target.unMute();
            const startTime = boundPlaybackTime(resumeAtRef.current, target.getDuration()) ?? 0;
            pendingSeekRef.current = { sourceKey: activeSourceKey, position: startTime, expiresAt: Date.now() + 2_000 };
            if (startTime > 0) target.seekTo(startTime, true);
            const sourceDuration = target.getDuration();
            setDuration(sourceDuration > 0 ? sourceDuration : activeRecord.duration);
            setIsReady(true);
            if (autoplayRef.current) playMedia();
          },
          onStateChange: ({ data }) => {
            if (!ownsCurrentSession()) return;
            if (data === 1) {
              if (!autoplayRef.current) { youtubePlayerRef.current?.pauseVideo?.(); return; }
              setIsPlaying(true); setIsLoading(false); setError(null);
              return;
            }
            if (data === 3) { setIsPlaying(false); setIsLoading(autoplayRef.current); return; }
            if (data === 2) { setIsPlaying(false); setIsLoading(false); return; }
            if (data === 0 && autoplayRef.current) onEndedRef.current();
          },
          onError: () => {
            if (!ownsCurrentSession()) return;
            youtubeFailureRef.current = "This video could not play. Try again.";
            setIsReady(false); setIsPlaying(false); setIsLoading(false);
            if (autoplayRef.current) setError(youtubeFailureRef.current);
            autoplayRef.current = false;
          }
        }
      });
    }).catch(() => {
      if (!ownsCurrentSession()) return;
      youtubeFailureRef.current = "The video player could not load. Try again.";
      setIsReady(false); setIsPlaying(false); setIsLoading(false);
      if (autoplayRef.current) setError(youtubeFailureRef.current);
      autoplayRef.current = false;
    });
    return () => {
      active = false;
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [activeRecord.duration, activeRecord.slug, activeRecord.startOffset, activeSourceKey, isYouTubeSource, playMedia, retryKey, youtubeId]);

  useEffect(() => {
    if (!isPlaying || !isYouTubeSource || !youtubeId) return;
    const timer = window.setInterval(() => {
      const nextTime = youtubePlayerRef.current?.getCurrentTime?.();
      const nextDuration = youtubePlayerRef.current?.getDuration?.();
      const acceptedTime = Number.isFinite(nextTime) ? acceptProviderPosition(activeSourceKey, nextTime as number) : null;
      if (acceptedTime !== null) { resumeAtRef.current = acceptedTime; currentTimeRef.current = acceptedTime; setCurrentTime(acceptedTime); }
      if (Number.isFinite(nextDuration) && (nextDuration as number) > 0) setDuration(nextDuration as number);
    }, 500);
    return () => window.clearInterval(timer);
  }, [acceptProviderPosition, activeSourceKey, isPlaying, isYouTubeSource, youtubeId]);

  const togglePlayback = useCallback(() => { if (isPlayable(activeRecord)) { if (autoplayRef.current) pauseMedia(); else if (error) retryPlayback(); else playMedia(); } }, [activeRecord, error, pauseMedia, playMedia, retryPlayback]);
  const seek = useCallback((seconds: number) => {
    const bounded = boundPlaybackTime(seconds, duration || activeRecord.duration);
    if (bounded === null) return;
    resumeAtRef.current = bounded;
    pendingSeekRef.current = { sourceKey: activeSourceKey, position: bounded, expiresAt: Date.now() + 2_000 };
    currentTimeRef.current = bounded;
    setCurrentTime(bounded);
    if (audioRef.current && audioRef.current.readyState >= 1) {
      try { audioRef.current.currentTime = bounded; } catch { /* The metadata handler will apply this queued seek. */ }
    }
    youtubePlayerRef.current?.seekTo?.(bounded, true);
    persist(bounded);
  }, [activeRecord.duration, activeSourceKey, duration, persist]);
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
    persist(currentTimeRef.current, { volume: bounded });
  }, [persist]);
  const toggleMuted = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (next) youtubePlayerRef.current?.mute?.(); else youtubePlayerRef.current?.unMute?.();
    persist(currentTimeRef.current, { muted: next });
  }, [isMuted, persist]);
  const toggleShuffle = useCallback(() => {
    const next = !isShuffled;
    setIsShuffled(next);
    setQueueOrder(next ? createShuffleOrder(canonicalQueue, activeRecord.slug) : canonicalQueue);
    persist(currentTimeRef.current, { shuffled: next });
  }, [activeRecord.slug, canonicalQueue, isShuffled, persist]);
  const cycleRepeatMode = useCallback(() => {
    const next = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    setRepeatMode(next);
    persist(currentTimeRef.current, { repeatMode: next });
  }, [persist, repeatMode]);
  const setSleepTimer = useCallback((timer: SleepTimer) => {
    if (timer !== null && timer !== "end" && ![15, 30, 45, 60].includes(timer)) return;
    const deadline = typeof timer === "number" ? Date.now() + timer * 60_000 : null;
    sleepDeadlineRef.current = deadline;
    setSleepTimerState(timer);
    persist(currentTimeRef.current, { sleepTimer: timer, sleepDeadline: deadline });
  }, [persist]);

  useEffect(() => {
    if (typeof sleepTimer !== "number" || sleepDeadlineRef.current === null) return;
    const remaining = Math.max(0, sleepDeadlineRef.current - Date.now());
    const timer = window.setTimeout(() => {
      pauseMedia();
      sleepDeadlineRef.current = null;
      setSleepTimerState(null);
      persist(currentTimeRef.current, { sleepTimer: null, sleepDeadline: null });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [pauseMedia, persist, sleepTimer]);

  useEffect(() => {
    ensureTabId();
    const acceptClaim = (claim: PlaybackClaim | null | undefined) => {
      if (!claim?.tabId || claim.tabId === tabIdRef.current) return;
      const owner = ownerClaimRef.current;
      if (owner && comparePlaybackClaims(claim, owner) <= 0) return;
      ownerClaimRef.current = claim;
      pauseMedia();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PLAYBACK_CLAIM_STORAGE_KEY || !event.newValue) return;
      try { acceptClaim(JSON.parse(event.newValue) as PlaybackClaim); } catch { /* Ignore incomplete claims from old builds. */ }
    };
    const channel = typeof window.BroadcastChannel === "function" ? new window.BroadcastChannel("lowkal-playback") : null;
    broadcastRef.current = channel;
    if (channel) channel.onmessage = (event: MessageEvent<{ type?: string; claim?: PlaybackClaim }>) => {
      if (event.data?.type === "play-claim") acceptClaim(event.data.claim);
    };
    window.addEventListener("storage", handleStorage);
    return () => { broadcastRef.current = null; channel?.close(); window.removeEventListener("storage", handleStorage); };
  }, [ensureTabId, pauseMedia]);

  useEffect(() => {
    const tabId = ensureTabId();
    const publishActivity = () => {
      try { window.localStorage.setItem(PLAYBACK_ACTIVITY_STORAGE_KEY, JSON.stringify({ tabId, expiresAt: Date.now() + 6_000 })); } catch { /* Update safety remains local if storage is unavailable. */ }
    };
    if (!isPlaying && !isLoading) {
      try {
        const active = JSON.parse(window.localStorage.getItem(PLAYBACK_ACTIVITY_STORAGE_KEY) ?? "null") as { tabId?: string } | null;
        if (active?.tabId === tabId) window.localStorage.removeItem?.(PLAYBACK_ACTIVITY_STORAGE_KEY);
      } catch { /* Ignore unavailable storage. */ }
      return;
    }
    publishActivity();
    const timer = window.setInterval(publishActivity, 2_000);
    return () => window.clearInterval(timer);
  }, [ensureTabId, isLoading, isPlaying]);

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
      session.metadata = null;
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
    const reconcileAudioLifecycle = () => {
      if (!document.hidden && typeof sleepTimer === "number" && sleepDeadlineRef.current !== null && Date.now() >= sleepDeadlineRef.current) {
        pauseMedia();
        sleepDeadlineRef.current = null;
        setSleepTimerState(null);
        persist(currentTimeRef.current, { sleepTimer: null, sleepDeadline: null });
        return;
      }
      if (!document.hidden || !isPlaying) return;
      persist();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    };
    document.addEventListener("visibilitychange", reconcileAudioLifecycle);
    return () => document.removeEventListener("visibilitychange", reconcileAudioLifecycle);
  }, [isPlaying, pauseMedia, persist, sleepTimer]);

  const postState = useCallback((target?: Window) => {
    const snapshot = stateRef.current;
    const audio = audioRef.current;
    const record = getRecord(snapshot.activeSlug) ?? firstRecord;
    const youtubeTime = youtubePlayerRef.current?.getCurrentTime?.();
    const youtubeDuration = youtubePlayerRef.current?.getDuration?.();
    const message = { channel: AUDIO_SYNC_CHANNEL, type: "state", state: { revision: ++stateRevisionRef.current, slug: record.slug, sourceKey: playbackSourceKey(record), provider: record.playback?.provider, currentTime: audio?.currentTime ?? youtubeTime ?? snapshot.currentTime, duration: audio?.duration || youtubeDuration || snapshot.duration || record.duration, isPlaying: snapshot.isPlaying, isReady: snapshot.isReady, isLoading: snapshot.isLoading, error: snapshot.error, volume: snapshot.volume, isMuted: snapshot.isMuted, isShuffled: snapshot.isShuffled, repeatMode: snapshot.repeatMode, isRepeat: snapshot.repeatMode !== "off", sleepTimer: snapshot.sleepTimer } };
    if (target) { target.postMessage(message, window.location.origin); return; }
    for (let index = 0; index < window.frames.length; index += 1) window.frames[index]?.postMessage(message, window.location.origin);
  }, [firstRecord, getRecord]);
  useEffect(() => { postState(); }, [activeSlug, currentTime, duration, isPlaying, isReady, isLoading, error, volume, isMuted, isShuffled, repeatMode, sleepTimer, postState]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source === window) return;
      const data = event.data as { channel?: string; type?: string; command?: AudioCommand } | null;
      if (!data || data.channel !== AUDIO_SYNC_CHANNEL || data.type !== "command" || !data.command) return;
      if (!isSoundroomFrameSource(event.source)) return;
      const command = data.command;
      if (command.action === "request-state") { if (event.source && "postMessage" in event.source) postState(event.source as Window); return; }
      if (command.action === "toggle") togglePlayback();
      if (command.action === "play") playMedia();
      if (command.action === "retry") retryPlayback();
      if (command.action === "pause") pauseMedia();
      if (command.action === "seek" && Number.isFinite(command.seconds)) seek(command.seconds);
      if (command.action === "seek-by" && Number.isFinite(command.seconds)) seekBy(command.seconds);
      if (command.action === "volume" && Number.isFinite(command.volume)) setVolume(command.volume);
      if (command.action === "mute") toggleMuted();
      if (command.action === "next") playNext();
      if (command.action === "previous") playPrevious();
      if (command.action === "shuffle") toggleShuffle();
      if (command.action === "repeat") cycleRepeatMode();
      if (command.action === "sleep") setSleepTimer(command.timer);
      if (command.action === "select" && typeof command.slug === "string" && typeof command.autoplay === "boolean") playRecord(command.slug, command.autoplay);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [cycleRepeatMode, pauseMedia, playMedia, playNext, playPrevious, playRecord, postState, retryPlayback, seek, seekBy, setSleepTimer, setVolume, toggleMuted, togglePlayback, toggleShuffle]);

  const value = useMemo<AudioContextValue>(() => ({ activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, retryPlayback, volume, isMuted, isShuffled, repeatMode, sleepTimer, sleepTimerMinutes: typeof sleepTimer === "number" ? sleepTimer : null, isExternalMediaPlaying, playRecord, togglePlayback, playNext, playPrevious, seek, seekBy, setVolume, toggleMuted, toggleShuffle, cycleRepeatMode, setSleepTimer }), [activeRecord, currentTime, duration, isPlaying, isReady, isLoading, error, retryPlayback, volume, isMuted, isShuffled, repeatMode, sleepTimer, isExternalMediaPlaying, playRecord, togglePlayback, playNext, playPrevious, seek, seekBy, setVolume, toggleMuted, toggleShuffle, cycleRepeatMode, setSleepTimer]);
  return (
    <AudioContext.Provider value={value}>
      {children}
      {cloudflareUrl ? (
        <audio key={`${activeRecord.slug}:${cloudflareUrl}`} ref={bindAudio} className="audio-engine" preload="metadata" onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            if (!isCurrentNativeEvent(audio, activeSourceKey)) return;
            const acceptedTime = acceptProviderPosition(activeSourceKey, audio.currentTime);
            if (acceptedTime === null) return;
            resumeAtRef.current = acceptedTime; currentTimeRef.current = acceptedTime; setCurrentTime(acceptedTime); persistThrottled(acceptedTime);
          }}
          onPlaying={(event) => {
            const audio = event.currentTarget;
            if (!isCurrentNativeEvent(audio, activeSourceKey)) return;
            if (!autoplayRef.current) { audio.pause(); return; }
            setIsPlaying(true); setIsLoading(false); setError(null);
          }}
          onWaiting={(event) => { if (isCurrentNativeEvent(event.currentTarget, activeSourceKey) && autoplayRef.current) setIsLoading(true); }}
          onPause={(event) => {
            const audio = event.currentTarget;
            if (!isCurrentNativeEvent(audio, activeSourceKey)) return;
            autoplayRef.current = false;
            setIsPlaying(false); setIsLoading(false); persist(audio.currentTime);
          }}
          onEnded={(event) => { if (isCurrentNativeEvent(event.currentTarget, activeSourceKey)) onEnded(); }}
          onError={(event) => {
            if (!isCurrentNativeEvent(event.currentTarget, activeSourceKey)) return;
            requestsRef.current.cancel(); autoplayRef.current = false; setIsReady(false); setIsPlaying(false); setIsLoading(false); setError("Audio could not load. Check your connection and retry.");
          }}>
          <track kind="captions" srcLang="en" label="No spoken content" src="data:text/vtt,WEBVTT" />
        </audio>
      ) : isYouTubeSource && youtubeId ? (
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
