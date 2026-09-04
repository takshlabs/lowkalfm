"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveMixPlayback } from "@/lib/audio-source";
import { artistProfiles, livePrograms, soundRecords, type ArchiveSection, type ArtistProfile, type LiveProgram, type SoundFormat, type SoundRecord } from "@/lib/content";
import { isSanityConfigured, listenContentQuery, sanityClient } from "@/lib/sanity";

type SanityArtist = ArtistProfile;
type SanityMix = {
  slug: string;
  format: "volume" | "liveSet" | "fullSession";
  series: string;
  title: string;
  artistDisplayName?: string;
  artists?: Array<{ name: string; slug: string }>;
  releaseDate: string;
  duration: number;
  audioMasterUrl?: string;
  audioMasterFilename?: string;
  audioDeliveryUrl?: string;
  externalUrl?: string;
  artwork?: string;
  genres?: string[];
  description?: string;
  shaderMoodPrompt?: string;
  featured?: boolean;
  archiveSection?: ArchiveSection;
  showInPlayer?: boolean;
  showInSoundroom?: boolean;
  showInArchive?: boolean;
  showOnHome?: boolean;
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
  records: SoundRecord[];
  programmes: LiveProgram[];
  artists: ArtistProfile[];
  getRecord: (slug: string) => SoundRecord | undefined;
  getArtist: (slug: string) => ArtistProfile | undefined;
};

const ListenContentContext = createContext<ListenContentValue | null>(null);

function formatDate(dateISO: string) {
  const date = new Date(`${dateISO}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? dateISO : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function mapMix(mix: SanityMix): SoundRecord | null {
  if (!mix.slug || !mix.artwork) return null;
  const artistNames = mix.artists?.map((artist) => artist.name).filter(Boolean) ?? [];
  const format: SoundFormat = mix.format === "volume" ? "weekly" : "live-set";
  const playback = resolveMixPlayback({ deliveryUrl: mix.audioDeliveryUrl, masterUrl: mix.audioMasterUrl, externalUrl: mix.externalUrl });
  return {
    slug: mix.slug,
    format,
    series: mix.series,
    title: mix.title,
    artist: mix.artistDisplayName || artistNames.join(" · ") || "Lowkal",
    artistSlugs: mix.artists?.map((artist) => artist.slug).filter(Boolean) ?? [],
    date: formatDate(mix.releaseDate),
    dateISO: mix.releaseDate,
    duration: mix.duration,
    ...playback,
    artwork: mix.artwork,
    genres: mix.genres ?? [],
    description: mix.description ?? "",
    shaderMoodPrompt: mix.shaderMoodPrompt?.trim() || undefined,
    featured: Boolean(mix.featured),
    programSlug: mix.programmeSlug,
    archiveSection: mix.archiveSection ?? "volumes-guests",
    showInPlayer: mix.showInPlayer !== false,
    showInSoundroom: mix.showInSoundroom !== false,
    showInArchive: mix.showInArchive !== false,
    showOnHome: mix.showOnHome !== false,
    tracks: mix.tracks ?? []
  };
}

export function ListenContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SanityListenContent | null>(null);

  useEffect(() => {
    if (!isSanityConfigured) return;
    let active = true;
    sanityClient.fetch<SanityListenContent>(listenContentQuery)
      .then((result) => { if (active) setContent(result); })
      .catch(() => { /* The local catalogue keeps Listen available if Sanity is unavailable. */ });
    return () => { active = false; };
  }, []);

  const value = useMemo<ListenContentValue>(() => {
    const fetchedRecords = content?.mixes?.map(mapMix).filter((record): record is SoundRecord => Boolean(record)) ?? [];
    const records = fetchedRecords.length > 0 ? fetchedRecords : soundRecords;
    const programmes = content?.programmes?.length
      ? content.programmes.map((programme) => ({
          slug: programme.slug,
          number: programme.number,
          name: programme.name,
          label: programme.label,
          date: formatDate(programme.dateISO),
          featuredSetSlug: programme.featuredSetSlug ?? programme.setSlugs?.[0] ?? "",
          setSlugs: programme.setSlugs ?? [],
          description: programme.description
        }))
      : livePrograms;
    const artists = content?.artists?.length ? content.artists.map((artist) => ({
      ...artist,
      bio: artist.bio ?? [],
      genres: artist.genres ?? [],
      links: artist.links ?? [],
      externalMixes: artist.externalMixes ?? [],
      productions: artist.productions ?? [],
      fieldNotes: artist.fieldNotes ?? []
    })) : artistProfiles;
    return {
      records,
      programmes,
      artists,
      getRecord: (slug: string) => records.find((record) => record.slug === slug),
      getArtist: (slug: string) => artists.find((artist) => artist.slug === slug)
    };
  }, [content]);

  return <ListenContentContext.Provider value={value}>{children}</ListenContentContext.Provider>;
}

export function useListenContent() {
  const context = useContext(ListenContentContext);
  if (!context) throw new Error("useListenContent must be used inside ListenContentProvider");
  return context;
}
