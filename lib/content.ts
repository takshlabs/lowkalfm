import { sitePath } from "@/lib/site-path";

export type SoundFormat = "weekly" | "live-set";

export type Track = {
  time: number;
  title: string;
  artist: string;
};

export type SoundRecord = {
  slug: string;
  format: SoundFormat;
  series: string;
  title: string;
  artist: string;
  date: string;
  dateISO: string;
  duration: number;
  youtubeId: string;
  artwork: string;
  genres: string[];
  description: string;
  featured?: boolean;
  programSlug?: string;
  tracks: Track[];
};

export type LiveProgram = {
  slug: string;
  number: string;
  name: string;
  label: string;
  date: string;
  featuredSetSlug: string;
  setSlugs: string[];
  description: string;
};

export const soundRecords: SoundRecord[] = [
  {
    slug: "lowkal-002-garden-city-gallivanting",
    format: "live-set",
    series: "Lowkal 002 | Garden City Gallivanting",
    title: "Full session",
    artist: "Samgod · Sinhatra · Takezo",
    date: "05 Jul 2026",
    dateISO: "2026-07-05",
    duration: 9366,
    youtubeId: "NZETtyc9MFo",
    artwork: sitePath("/lowkal-002.jpg"),
    genres: ["Multi-genre", "Low end", "B2B2B"],
    description: "Samgod, Sinhatra and Takezo share one long Lowkal session from Bengaluru.",
    featured: true,
    programSlug: "lowkal-002-garden-city-gallivanting",
    tracks: []
  },
  {
    slug: "lowkal-fm-vol-01",
    format: "weekly",
    series: "Lowkal.fm Vol. 01",
    title: "Redline 006",
    artist: "Takezo",
    date: "13 Apr 2026",
    dateISO: "2026-04-13",
    duration: 3120,
    youtubeId: "fw2mtwgCeGo",
    artwork: sitePath("/kinetic-drift.png"),
    genres: ["Drum + bass", "Breaks", "Footwork"],
    description: "A low-to-high pressure mix built around shifting drums, deep bass and the many forms that keep a floor moving.",
    tracks: [
      { time: 0, title: "Intro (Atmosphere)", artist: "Unknown" },
      { time: 255, title: "Sub-bass Frequency", artist: "Autechre" },
      { time: 750, title: "Glitch Sequence 01", artist: "Aphex Twin" },
      { time: 2712, title: "Neon Drift", artist: "Overmono" }
    ]
  },
  {
    slug: "lowkal-fm-vol-02",
    format: "weekly",
    series: "Lowkal.fm Vol. 02",
    title: "Meeting Point",
    artist: "sa:rang",
    date: "19 Mar 2026",
    dateISO: "2026-03-19",
    duration: 4200,
    youtubeId: "60O126HehGA",
    artwork: sitePath("/meeting-point.png"),
    genres: ["Footwork", "Polyrhythmic", "Bass"],
    description: "A fast-moving meeting point between polyrhythm, bass pressure and wide electronic space.",
    tracks: [
      { time: 0, title: "La Real", artist: "Surgeon" },
      { time: 270, title: "Why They Hide Their Bodies Under My Garage", artist: "Blawan" },
      { time: 555, title: "Pace Yourself", artist: "Karenn" },
      { time: 945, title: "Penny & Pound", artist: "Ansome" }
    ]
  },
  {
    slug: "lowkal-001-takezo",
    format: "live-set",
    series: "Lowkal 001 | Redline",
    title: "Featured set",
    artist: "Takezo",
    date: "13 Apr 2026",
    dateISO: "2026-04-13",
    duration: 3120,
    youtubeId: "fw2mtwgCeGo",
    artwork: sitePath("/kinetic-drift.png"),
    genres: ["Drum + bass", "Breaks"],
    description: "The featured set from Lowkal 001, selected from the full multi-artist programme.",
    featured: true,
    programSlug: "lowkal-001-redline",
    tracks: [
      { time: 0, title: "Intro (Atmosphere)", artist: "Unknown" },
      { time: 255, title: "Sub-bass Frequency", artist: "Autechre" },
      { time: 750, title: "Glitch Sequence 01", artist: "Aphex Twin" },
      { time: 2712, title: "Neon Drift", artist: "Overmono" }
    ]
  },
  {
    slug: "lowkal-001-sarang",
    format: "live-set",
    series: "Lowkal 001 | Redline",
    title: "Live set",
    artist: "sa:rang",
    date: "13 Apr 2026",
    dateISO: "2026-04-13",
    duration: 4200,
    youtubeId: "60O126HehGA",
    artwork: sitePath("/meeting-point.png"),
    genres: ["Footwork", "Polyrhythmic"],
    description: "A set from Lowkal 001, held inside the complete live-program record.",
    programSlug: "lowkal-001-redline",
    tracks: [
      { time: 0, title: "La Real", artist: "Surgeon" },
      { time: 270, title: "Why They Hide Their Bodies Under My Garage", artist: "Blawan" },
      { time: 555, title: "Pace Yourself", artist: "Karenn" }
    ]
  }
];

export const livePrograms: LiveProgram[] = [
  {
    slug: "lowkal-002-garden-city-gallivanting",
    number: "002",
    name: "Garden City Gallivanting",
    label: "Lowkal 002 | Garden City Gallivanting",
    date: "05 Jul 2026",
    featuredSetSlug: "lowkal-002-garden-city-gallivanting",
    setSlugs: ["lowkal-002-garden-city-gallivanting"],
    description: "A shared multi-genre session with Samgod, Sinhatra and Takezo."
  },
  {
    slug: "lowkal-001-redline",
    number: "001",
    name: "Redline",
    label: "Lowkal 001 | Redline",
    date: "13 Apr 2026",
    featuredSetSlug: "lowkal-001-takezo",
    setSlugs: ["lowkal-001-takezo", "lowkal-001-sarang"],
    description: "A multi-artist live programme. Each Lowkal programme keeps every set together and marks one set as the featured recording."
  }
];

export type JournalStory = {
  type: string;
  title: string;
  deck: string;
  byline: string;
  readTime: string;
  tone: "paper" | "red" | "accent" | "ink";
  excerpt: string;
};

export type CityEvent = {
  date: string;
  time: string;
  title: string;
  venue: string;
  access: string;
  type: string;
  reason: string;
};

export const journalStories: JournalStory[] = [];

export const cityEvents: CityEvent[] = [];

export function getSoundRecord(slug: string) {
  return soundRecords.find((record) => record.slug === slug);
}

export function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
