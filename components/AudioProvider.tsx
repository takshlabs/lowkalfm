"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SoundRecord } from "@/lib/content";
import { useListenContent } from "./ListenContentProvider";

const STORAGE_KEY = "lowkal.player.v1";
const PLAYBACK_INTENT_KEY = "lowkal.player.playback-intent.v1";
const AUDIO_SYNC_CHANNEL = "lowkal.audio.v1";

type SavedPlayerState = { slug: string; currentTime: number; volume: number; savedAt: number };
type AudioCommand =
  | { action: "request-state" } | { action: "toggle" } | { action: "play" } | { action: "pause" }
  | { action: "seek"; seconds: number } | { action: "volume"; volume: number }
  | { action: "shuffle" } | { action: "repeat" } | { action: "select"; slug: string; autoplay: boolean };
type AudioContextValue = {
  activeRecord: SoundRecord; currentTime: number; duration: number; isPlaying: boolean; isReady: boolean; volume: number;
  playRecord: (slug: string, autoplay?: boolean) => void; togglePlayback: () => void; seek: (seconds: number) => void; setVolume: (volume: number) => void;
};

const AudioContext = createContext<AudioContextValue | null>(null);

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
  const playableRecords = useMemo(() => records.filter((record) => record.showInPlayer), [records]);
  const firstRecord = playableRecords[0] ?? records[0];
  const [activeSlug, setActiveSlug] = useState(firstRecord.slug);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(firstRecord.duration);
  const [volume, setVolumeState] = useState(82);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resumeAtRef = useRef(0);
  const autoplayRef = useRef(typeof window !== "undefined" && readPlaybackIntent());
  const currentTimeRef = useRef(0);
  const activeRecord = getRecord(activeSlug) ?? firstRecord;
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

  const persist = useCallback((time = currentTimeRef.current) => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ slug: activeRecord.slug, currentTime: time, volume, savedAt: Date.now() } satisfies SavedPlayerState)); } catch { /* Playback still works if storage is unavailable. */ }
  }, [activeRecord.slug, volume]);
  useEffect(() => {
    const handlePageExit = () => persist();
    window.addEventListener("pagehide", handlePageExit);
    return () => window.removeEventListener("pagehide", handlePageExit);
  }, [persist]);

  const playMedia = useCallback(() => {
    if (!audioRef.current || !activeRecord.audioUrl) return;
    savePlaybackIntent(true); autoplayRef.current = true;
    void audioRef.current.play().catch(() => { setIsPlaying(false); savePlaybackIntent(false); });
  }, [activeRecord.audioUrl]);
  const pauseMedia = useCallback(() => { savePlaybackIntent(false); autoplayRef.current = false; audioRef.current?.pause(); }, []);

  const playRecord = useCallback((slug: string, shouldPlay = true) => {
    const record = getRecord(slug);
    if (!record?.audioUrl) return;
    if (slug === activeSlug && audioRef.current) { if (shouldPlay) playMedia(); else pauseMedia(); return; }
    savePlaybackIntent(shouldPlay); autoplayRef.current = shouldPlay; resumeAtRef.current = 0;
    setCurrentTime(0); setDuration(record.duration); setIsPlaying(false); setIsReady(false); setActiveSlug(slug);
  }, [activeSlug, getRecord, pauseMedia, playMedia]);

  const playNext = useCallback(() => {
    const available = playableRecords.filter((record, index, items) => items.findIndex((item) => item.slug === record.slug) === index && Boolean(record.audioUrl));
    const currentIndex = Math.max(0, available.findIndex((record) => record.slug === activeRecord.slug));
    let nextIndex = (currentIndex + 1) % available.length;
    if (isShuffled && available.length > 1) do { nextIndex = Math.floor(Math.random() * available.length); } while (nextIndex === currentIndex);
    if (available[nextIndex]) playRecord(available[nextIndex].slug, true);
  }, [activeRecord.slug, isShuffled, playRecord, playableRecords]);

  const onLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    if (resumeAtRef.current > 0) audio.currentTime = resumeAtRef.current;
    setDuration(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : activeRecord.duration);
    setIsReady(true);
    if (autoplayRef.current) playMedia();
  }, [activeRecord.duration, playMedia, volume]);
  const onEnded = useCallback(() => {
    persist();
    if (isRepeat && audioRef.current) { audioRef.current.currentTime = 0; playMedia(); return; }
    playNext();
  }, [isRepeat, persist, playMedia, playNext]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: `${activeRecord.series} — ${activeRecord.title}`, artist: activeRecord.artist, album: "Lowkal Soundroom", artwork: [{ src: activeRecord.artwork, sizes: "512x512", type: "image/png" }] });
    navigator.mediaSession.setActionHandler("play", playMedia);
    navigator.mediaSession.setActionHandler("pause", pauseMedia);
    navigator.mediaSession.setActionHandler("seekto", (details) => { if (details.seekTime != null && audioRef.current) audioRef.current.currentTime = details.seekTime; });
    return () => { navigator.mediaSession.setActionHandler("play", null); navigator.mediaSession.setActionHandler("pause", null); navigator.mediaSession.setActionHandler("seekto", null); };
  }, [activeRecord, pauseMedia, playMedia]);

  const togglePlayback = useCallback(() => { if (activeRecord.audioUrl) { if (isPlaying) pauseMedia(); else playMedia(); } }, [activeRecord.audioUrl, isPlaying, pauseMedia, playMedia]);
  const seek = useCallback((seconds: number) => {
    const bounded = Math.min(duration || activeRecord.duration, Math.max(0, seconds));
    setCurrentTime(bounded); if (audioRef.current) audioRef.current.currentTime = bounded; persist(bounded);
  }, [activeRecord.duration, duration, persist]);
  const setVolume = useCallback((nextVolume: number) => { const bounded = Math.min(100, Math.max(0, nextVolume)); setVolumeState(bounded); if (audioRef.current) audioRef.current.volume = bounded / 100; }, []);

  const postState = useCallback((target?: Window) => {
    const snapshot = stateRef.current;
    const audio = audioRef.current;
    const record = getRecord(snapshot.activeSlug) ?? firstRecord;
    const message = { channel: AUDIO_SYNC_CHANNEL, type: "state", state: { slug: record.slug, audioUrl: record.audioUrl, currentTime: audio?.currentTime ?? snapshot.currentTime, duration: audio?.duration || snapshot.duration || record.duration, isPlaying: Boolean(audio && !audio.paused && !audio.ended), isReady: snapshot.isReady, volume: snapshot.volume, isShuffled: snapshot.isShuffled, isRepeat: snapshot.isRepeat } };
    if (target) { target.postMessage(message, window.location.origin); return; }
    for (let index = 0; index < window.frames.length; index += 1) window.frames[index]?.postMessage(message, window.location.origin);
  }, [firstRecord, getRecord]);
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
      {activeRecord.audioUrl ? (
        <audio key={activeRecord.slug} ref={audioRef} className="audio-engine" src={activeRecord.audioUrl} preload="metadata" onLoadedMetadata={onLoadedMetadata} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); persist(event.currentTarget.currentTime); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={onEnded} onError={() => { setIsReady(false); setIsPlaying(false); }}>
          <track kind="captions" srcLang="en" label="No spoken content" src="data:text/vtt,WEBVTT" />
        </audio>
      ) : null}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) throw new Error("useAudio must be used inside AudioProvider");
  return context;
}
