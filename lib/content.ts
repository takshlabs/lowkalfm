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
    description: "The featured set from Lowkal 001, selected from the full multi-artist live transmission.",
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
    slug: "lowkal-001-redline",
    number: "001",
    name: "Redline",
    label: "Lowkal 001 | Redline",
    date: "13 Apr 2026",
    featuredSetSlug: "lowkal-001-takezo",
    setSlugs: ["lowkal-001-takezo", "lowkal-001-sarang"],
    description: "A multi-artist live transmission. Each Lowkal program keeps every set together and marks one set as the featured recording."
  }
];

export const journalStories = [
  {
    type: "Conversation",
    title: "Who keeps the dancefloor alive?",
    deck: "A conversation with the sound engineers, door crews and night workers who hold an independent scene together.",
    byline: "Lowkal editorial",
    readTime: "7 min",
    tone: "red",
    excerpt: "The people at the edge of the booth shape a night as much as the person inside it. We speak with a sound engineer, a door host and a closing-shift worker about care, pressure and the unseen work of keeping a room open."
  },
  {
    type: "Field note",
    title: "Under the flyover, rain becomes percussion",
    deck: "A short recording and notebook from a wet evening under the city’s concrete lines.",
    byline: "Lowkal field unit",
    readTime: "4 min + audio",
    tone: "signal",
    excerpt: "Rain strikes the metal dividers in uneven sixes. Buses add a low pulse, and water running from the flyover makes a second, softer rhythm. This note follows one recording from first drop to sudden quiet."
  },
  {
    type: "Photo essay",
    title: "Neon, tarpaulin and the last bus home",
    deck: "Fourteen frames from the long walk out after the music stops.",
    byline: "Guest photographer",
    readTime: "14 frames",
    tone: "ink",
    excerpt: "After the last track, the city changes scale. Plastic roofs hold small pools of red light, empty buses pass without stopping and each remaining food cart becomes its own bright room."
  },
  {
    type: "Artist focus",
    title: "sa:rang on rhythm as a meeting place",
    deck: "A selector’s notes on groove, space and making very different records speak to one another.",
    byline: "Lowkal editorial",
    readTime: "9 min",
    tone: "paper",
    excerpt: "For sa:rang, selection is a form of conversation. The thread is not genre or year. It is the moment when two very different records reveal that they share the same centre of gravity."
  }
];

export const cityEvents = [
  {
    date: "Thu 27 Aug",
    time: "19:30",
    title: "Lowkal Listening Room: Polyrhythms",
    venue: "Domlur",
    access: "Step-free · Free with RSVP",
    type: "Listening session",
    reason: "A focused hour for hearing polyrhythm at room scale, followed by an open discussion with the selectors."
  },
  {
    date: "Fri 28 Aug",
    time: "21:00",
    title: "Selectors: sa:rang + guests",
    venue: "Indiranagar",
    access: "₹400 · Limited capacity",
    type: "Club night",
    reason: "A small-room bill with patient opening sets and enough time for each guest to build a full arc."
  },
  {
    date: "Sun 30 Aug",
    time: "16:00",
    title: "Field recording walk: lake edges",
    venue: "Bellandur",
    access: "Outdoors · 12 places",
    type: "Workshop",
    reason: "A practical walk about listening to the city without treating the city as background noise."
  },
  {
    date: "Wed 02 Sep",
    time: "18:30",
    title: "Open decks and listening hour",
    venue: "Shivajinagar",
    access: "Free · Bring one record",
    type: "Community",
    reason: "A low-pressure place to share one record, meet another listener and try the decks for the first time."
  }
];

export function getSoundRecord(slug: string) {
  return soundRecords.find((record) => record.slug === slug);
}

export function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
