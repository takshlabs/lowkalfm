import { getMixStartOffset, getYouTubeVideoUrl, resolveMixPlayback } from "./audio-source.ts";
import type { ArchiveSection, ArtistProfile, LiveProgram, SoundFormat, SoundRecord } from "./content.ts";
import { sortMixesByLatest } from "./listen-order.ts";

export type SanityArtist = ArtistProfile;
export type SanityMix = {
  slug: string;
  format: "volume" | "liveSet" | "fullSession";
  series: string;
  title: string;
  artistDisplayName?: string;
  artists?: Array<{ name: string; slug: string }>;
  releaseDate: string;
  duration?: number;
  audioDeliveryUrl?: string;
  audioStartOffset?: number;
  youtubeUrl?: string;
  youtubeVideoUrl?: string;
  artwork?: string;
  genres?: string[];
  description?: string;
  shaderMoodPrompt?: string;
  featured?: boolean;
  archiveSection?: ArchiveSection;
  tracks?: SoundRecord["tracks"];
  programmeSlug?: string;
};
export type SanityProgramme = Omit<LiveProgram, "featuredSetSlug" | "setSlugs" | "date"> & {
  dateISO: string;
  featuredSetSlug?: string;
  setSlugs?: string[];
};
export type SanityListenContent = { mixes?: SanityMix[]; programmes?: SanityProgramme[]; artists?: SanityArtist[] };
export type ListenContentValue = {
  records: SoundRecord[];
  programmes: LiveProgram[];
  artists: ArtistProfile[];
  getRecord: (slug: string) => SoundRecord | undefined;
  getArtist: (slug: string) => ArtistProfile | undefined;
};

function formatDate(dateISO: string) {
  const date = new Date(`${dateISO}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? dateISO : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function mapSanityMix(mix: SanityMix): SoundRecord | null {
  if (!mix.slug || !mix.artwork) return null;
  const artistNames = mix.artists?.map((artist) => artist.name).filter(Boolean) ?? [];
  const format: SoundFormat = mix.format === "volume" ? "weekly" : "live-set";
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
    startOffset: getMixStartOffset(mix.audioStartOffset),
    playback,
    youtubeVideoUrl: getYouTubeVideoUrl(mix.youtubeVideoUrl ?? mix.youtubeUrl),
    artwork: mix.artwork,
    genres: mix.genres ?? [],
    description: mix.description ?? "",
    shaderMoodPrompt: mix.shaderMoodPrompt?.trim() || undefined,
    featured: Boolean(mix.featured),
    programSlug: mix.programmeSlug,
    archiveSection: mix.archiveSection ?? "volumes-guests",
    showInPlayer: true,
    showInSoundroom: true,
    showInArchive: true,
    showOnHome: true,
    tracks: mix.tracks ?? []
  };
}

export function resolveListenCatalogue(content: SanityListenContent | null): ListenContentValue {
  const fetchedRecords = content?.mixes?.map(mapSanityMix).filter((record): record is SoundRecord => Boolean(record)) ?? [];
  const records = sortMixesByLatest(fetchedRecords);
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
    : [];
  const artists = content?.artists?.length
    ? content.artists.map((artist) => ({
        ...artist,
        bio: artist.bio ?? [],
        genres: artist.genres ?? [],
        links: artist.links ?? [],
        externalMixes: artist.externalMixes ?? [],
        productions: artist.productions ?? [],
        fieldNotes: artist.fieldNotes ?? []
      }))
    : [];
  return {
    records,
    programmes,
    artists,
    getRecord: (slug: string) => records.find((record) => record.slug === slug),
    getArtist: (slug: string) => artists.find((artist) => artist.slug === slug)
  };
}
