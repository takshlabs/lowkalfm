"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { getMixStartOffset, getYouTubeVideoUrl, resolveMixPlayback } from "@/lib/audio-source";
import { artistProfiles, livePrograms, soundRecords, type ArchiveSection, type ArtistProfile, type LiveProgram, type SoundFormat, type SoundRecord } from "@/lib/content";
import { sortMixesByLatest } from "@/lib/listen-order";
import { isSanityConfigured, listenContentQuery, sanityFetch, sanityImageUrl } from "@/lib/sanity";

type SanityArtist = ArtistProfile;
type SanityMix = {
  slug: string;
  format: "volume" | "liveSet" | "fullSession";
  series: string;
  title: string;
  artistDisplayName?: string;
  artists?: Array<{ name: string; slug: string }>;
  releaseDate: string;
  duration?: number;
  listenCount?: number;
  audioDeliveryUrl?: string;
  audioPeaksUrl?: string;
  audioStartOffset?: number;
  youtubeUrl?: string;
  youtubeVideoUrl?: string;
  artwork?: string;
  genres?: string[];
  description?: string;
  shaderMoodPrompt?: string;
  featured?: boolean;
  playerOrder?: number;
  soundroomOrder?: number;
  archiveOrder?: number;
  homeOrder?: number;
  showInPlayer?: boolean;
  showInSoundroom?: boolean;
  showInArchive?: boolean;
  showOnHome?: boolean;
  archiveSection?: ArchiveSection;
  tracks?: SoundRecord["tracks"];
  programmeSlug?: string;
};

type SanityProgramme = Omit<LiveProgram, "featuredSetSlug" | "setSlugs" | "date"> & {
  dateISO: string;
  featuredSetSlug?: string;
  setSlugs?: string[];
};

type SanityListenContent = { mixes?: SanityMix[]; programmes?: SanityProgramme[]; artists?: SanityArtist[] };

type ListenContentValue = {
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  records: SoundRecord[];
  programmes: LiveProgram[];
  artists: ArtistProfile[];
  getRecord: (slug: string) => SoundRecord | undefined;
  getArtist: (slug: string) => ArtistProfile | undefined;
  listenCounts: Record<string, number>;
  beginListen: (record: SoundRecord) => Promise<string | null>;
  recordListen: (record: SoundRecord, ticket: string) => void;
};

const useLocalCatalogue = !isSanityConfigured && process.env.NODE_ENV !== "production";

const ListenContentContext = createContext<ListenContentValue | null>(null);
const LISTEN_COUNTS_URL = "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev/listen-counts";
const VISITOR_KEY = "lowkal:listen-visitor:v1";

function formatDate(dateISO: string) {
  const date = new Date(`${dateISO}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? dateISO : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function mapMix(mix: SanityMix): SoundRecord | null {
  if (!mix.slug || !mix.artwork) return null;
  const artistNames = mix.artists?.map((artist) => artist.name).filter(Boolean) ?? [];
  const format: SoundFormat = mix.format === "volume" ? "weekly" : "live-set";
  // Older published records can contain only the video-link field. Treat it as
  // the YouTube source only when no dedicated audio source is present.
  const youtubeSourceUrl = mix.youtubeUrl ?? mix.youtubeVideoUrl;
  const playback = resolveMixPlayback({ deliveryUrl: mix.audioDeliveryUrl, youtubeUrl: youtubeSourceUrl });
  return {
    slug: mix.slug,
    format,
    series: mix.series,
    title: mix.title,
    artist: mix.artistDisplayName || artistNames.join(" · ") || "Lowkal",
    artistSlugs: mix.artists?.map((artist) => artist.slug).filter(Boolean) ?? [],
    date: formatDate(mix.releaseDate),
    dateISO: mix.releaseDate,
    duration: mix.duration ?? 0,
    listenCount: mix.listenCount,
    startOffset: getMixStartOffset(mix.audioStartOffset),
    playback,
    waveformPeaksUrl: mix.audioPeaksUrl,
    youtubeVideoUrl: getYouTubeVideoUrl(mix.youtubeVideoUrl ?? mix.youtubeUrl),
    artwork: sanityImageUrl(mix.artwork),
    genres: mix.genres ?? [],
    description: mix.description ?? "",
    shaderMoodPrompt: mix.shaderMoodPrompt?.trim() || undefined,
    featured: Boolean(mix.featured),
    programSlug: mix.programmeSlug,
    archiveSection: mix.archiveSection ?? "volumes-guests",
    playerOrder: mix.playerOrder,
    soundroomOrder: mix.soundroomOrder,
    archiveOrder: mix.archiveOrder,
    homeOrder: mix.homeOrder,
    showInPlayer: mix.showInPlayer !== false,
    showInSoundroom: mix.showInSoundroom !== false,
    showInArchive: mix.showInArchive !== false,
    showOnHome: mix.showOnHome !== false,
    tracks: mix.tracks ?? []
  };
}

export function ListenContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SanityListenContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  const [listenCounts, setListenCounts] = useState<Record<string, number>>({});
  const countedMixesRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isSanityConfigured) return;
    let active = true;
    // Remove snapshots from older releases. Never render a saved CMS catalogue.
    try { window.sessionStorage.removeItem("lowkal:listen-content:v1"); } catch { /* Storage is optional. */ }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    sanityFetch<SanityListenContent>(listenContentQuery, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setContent((previous) => JSON.stringify(previous) === JSON.stringify(result) ? previous : result);
        window.clearTimeout(timeout);
        setError(null);
      })
      .catch(() => { window.clearTimeout(timeout); if (active) setError("Cannot load the records. Try again."); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [refreshKey]);

  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60_000);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    const mixes = content?.mixes?.map((mix) => mix.slug) ?? [];
    for (const slug of mixes) {
      if (!slug) continue;
      fetch(`${LISTEN_COUNTS_URL}?mix=${encodeURIComponent(slug)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<{ total: number }> : null)
        .then((result) => { if (result && Number.isSafeInteger(result.total)) setListenCounts((current) => ({ ...current, [slug]: Math.max(current[slug] ?? 0, result.total) })); })
        .catch(() => { /* Show the published baseline if counts are unavailable. */ });
    }
    return () => controller.abort();
  }, [content]);

  const beginListen = useCallback(async (record: SoundRecord) => {
    if (record.playback?.provider !== "cloudflare" || countedMixesRef.current.has(record.slug)) return null;
    let visitorToken: string | null = null;
    try { visitorToken = window.localStorage.getItem(VISITOR_KEY); } catch { /* Storage is optional. */ }
    try {
      const response = await fetch(LISTEN_COUNTS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", mix: record.slug, visitorToken }) });
      if (!response.ok) return null;
      const result = await response.json() as { visitorToken: string; ticket: string };
      try { window.localStorage.setItem(VISITOR_KEY, result.visitorToken); } catch { /* Storage is optional. */ }
      return result.ticket;
    } catch { return null; }
  }, []);

  const recordListen = useCallback((record: SoundRecord, ticket: string) => {
    if (record.playback?.provider !== "cloudflare") return;
    if (countedMixesRef.current.has(record.slug)) return;
    countedMixesRef.current.add(record.slug);
    fetch(LISTEN_COUNTS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listen", mix: record.slug, ticket }) })
      .then((response) => { if (!response.ok) throw new Error("Listen was not saved"); return response.json() as Promise<{ total: number }>; })
      .then((result) => { if (result && Number.isSafeInteger(result.total)) setListenCounts((current) => ({ ...current, [record.slug]: Math.max(current[record.slug] ?? 0, result.total) })); })
      .catch(() => { countedMixesRef.current.delete(record.slug); });
    track("mix_listen", { mix: record.slug, series: record.series });
  }, []);

  const catalogue = useMemo(() => {
    const fetchedRecords = content?.mixes?.map(mapMix).filter((record): record is SoundRecord => Boolean(record)) ?? [];
    const records = sortMixesByLatest(content ? fetchedRecords : useLocalCatalogue ? soundRecords : []);
    const programmes = content
      ? (content.programmes ?? []).map((programme) => ({
          slug: programme.slug,
          number: programme.number,
          name: programme.name,
          label: programme.label,
          date: formatDate(programme.dateISO),
          featuredSetSlug: programme.featuredSetSlug ?? programme.setSlugs?.[0] ?? "",
          setSlugs: programme.setSlugs ?? [],
          description: programme.description
        }))
      : useLocalCatalogue ? livePrograms : [];
    const artists = content ? (content.artists ?? []).map((artist) => ({
      ...artist,
      bio: artist.bio ?? [],
      genres: artist.genres ?? [],
      links: artist.links ?? [],
      externalMixes: artist.externalMixes ?? [],
      productions: artist.productions ?? [],
      fieldNotes: (artist.fieldNotes ?? []).map((note) => ({ ...note, tags: note.tags ?? [] }))
    })) : useLocalCatalogue ? artistProfiles : [];
    return {
      records,
      programmes,
      artists,
      getRecord: (slug: string) => records.find((record) => record.slug === slug),
      getArtist: (slug: string) => artists.find((artist) => artist.slug === slug),
    };
  }, [content]);

  const value = useMemo<ListenContentValue>(() => ({ ...catalogue, listenCounts, beginListen, recordListen, isLoading: isSanityConfigured && !content && !error, error, refresh }), [catalogue, listenCounts, beginListen, recordListen, content, error, refresh]);

  return <ListenContentContext.Provider value={value}>{children}</ListenContentContext.Provider>;
}

export function useListenContent() {
  const context = useContext(ListenContentContext);
  if (!context) throw new Error("useListenContent must be used inside ListenContentProvider");
  return context;
}
