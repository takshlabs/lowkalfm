import { createReadStream } from "node:fs";
import { basename, resolve } from "node:path";
import { createClient } from "@sanity/client";

const projectId = process.env.SANITY_API_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_API_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || !token) throw new Error("Sanity project and write token are required.");

const client = createClient({ projectId, dataset, token, apiVersion: "2026-08-24", useCdn: false });
const root = process.cwd();

function block(key, text) {
  return { _key: key, _type: "block", style: "normal", markDefs: [], children: [{ _key: `${key}-text`, _type: "span", marks: [], text }] };
}

async function uploadArtwork(path) {
  const filePath = resolve(root, path);
  return client.assets.upload("image", createReadStream(filePath), { filename: basename(filePath) });
}

const artists = [
  {
    _id: "artist-takezo",
    _type: "artist",
    name: "Takezo",
    slug: { _type: "slug", current: "takezo" },
    relationship: "resident",
    location: "Bengaluru",
    genres: ["Drum + bass", "Breaks", "Garage", "Footwork"],
    shortBio: "Saswat Biswas, known as Takezo, moves through bass music with a focus on rhythm, intensity, and the dancefloor.",
    bio: [
      block("takezo-1", "A drive to move the dancefloor through eclectic sonic journeys defines Saswat Biswas, better known as Takezo, within the Indian underground."),
      block("takezo-2", "His sets move through breaks, garage, footwork, and drum and bass. He balances technical range with a focus on emotional intensity."),
      block("takezo-3", "Takezo is the founder and curator of Lowkal.fm, a grassroots collective focused on low-end frequencies and community-driven sound.")
    ],
    links: [], featuredMix: { _type: "reference", _ref: "mix-lowkal-fm-vol-01" }, externalMixes: [], productions: [], fieldNotes: [], published: true, sortOrder: 10
  },
  {
    _id: "artist-sa-rang", _type: "artist", name: "sa:rang", slug: { _type: "slug", current: "sa-rang" }, relationship: "guest", location: "Bengaluru",
    genres: ["Footwork", "Polyrhythmic", "Bass"],
    shortBio: "Bengaluru musician and DJ sa:rang builds sets from grooved rhythms, broad soundscapes, and electronic dance music.",
    bio: [block("sarang-1", "sa:rang is a Bengaluru musician and DJ. His sound combines grooved rhythms, broad soundscapes, electronic music, and dance music. His performances take the audience through a focused sonic journey built for the dancefloor.")],
    links: [], featuredMix: { _type: "reference", _ref: "mix-lowkal-fm-vol-02" }, externalMixes: [], productions: [], fieldNotes: [], published: true, sortOrder: 20
  },
  { _id: "artist-samgod", _type: "artist", name: "Samgod", slug: { _type: "slug", current: "samgod" }, relationship: "guest", location: "", genres: [], shortBio: "", bio: [], links: [], externalMixes: [], productions: [], fieldNotes: [], published: true, sortOrder: 30 },
  { _id: "artist-sinhatra", _type: "artist", name: "Sinhatra", slug: { _type: "slug", current: "sinhatra" }, relationship: "guest", location: "", genres: [], shortBio: "", bio: [], links: [], externalMixes: [], productions: [], fieldNotes: [], published: true, sortOrder: 40 }
];

const tracklists = {
  takezo: [
    { _key: "t1", _type: "track", time: 0, title: "Intro (Atmosphere)", artist: "Unknown" },
    { _key: "t2", _type: "track", time: 255, title: "Sub-bass Frequency", artist: "Autechre" },
    { _key: "t3", _type: "track", time: 750, title: "Glitch Sequence 01", artist: "Aphex Twin" },
    { _key: "t4", _type: "track", time: 2712, title: "Neon Drift", artist: "Overmono" }
  ],
  sarang: [
    { _key: "s1", _type: "track", time: 0, title: "La Real", artist: "Surgeon" },
    { _key: "s2", _type: "track", time: 270, title: "Why They Hide Their Bodies Under My Garage", artist: "Blawan" },
    { _key: "s3", _type: "track", time: 555, title: "Pace Yourself", artist: "Karenn" },
    { _key: "s4", _type: "track", time: 945, title: "Penny & Pound", artist: "Ansome" }
  ]
};

function ref(_ref, _key) { return { _key, _type: "reference", _ref }; }

async function main() {
  const [sessionArt, takezoArt, sarangArt] = await Promise.all([
    uploadArtwork("public/lowkal-002.jpg"),
    uploadArtwork("public/kinetic-drift.png"),
    uploadArtwork("public/meeting-point.png")
  ]);

  const commonPlacement = { published: true, showInPlayer: true, showInArchive: true };
  const mixes = [
    {
      _id: "mix-lowkal-002-garden-city-gallivanting", _type: "mix", title: "Full session", slug: { _type: "slug", current: "lowkal-002-garden-city-gallivanting" },
      series: "Lowkal 002 | Garden City Gallivanting", format: "fullSession", artists: [ref("artist-samgod", "samgod"), ref("artist-sinhatra", "sinhatra"), ref("artist-takezo", "takezo")], artistDisplayName: "Samgod · Sinhatra · Takezo",
      releaseDate: "2026-07-05", duration: 9366, externalUrl: "https://www.youtube.com/watch?v=NZETtyc9MFo", artwork: { _type: "image", asset: { _type: "reference", _ref: sessionArt._id }, alt: "Lowkal 002 artwork" },
      genres: ["Multi-genre", "Low end", "B2B2B"], description: "Samgod, Sinhatra and Takezo share one long Lowkal session from Bengaluru.", tracks: [], featured: true,
      ...commonPlacement, showInSoundroom: true, showOnHome: true, archiveSection: "scene-programmes", playerOrder: 10, soundroomOrder: 10, archiveOrder: 10, homeOrder: 10
    },
    {
      _id: "mix-lowkal-fm-vol-01", _type: "mix", title: "Redline 006", slug: { _type: "slug", current: "lowkal-fm-vol-01" }, series: "Lowkal.fm Vol. 01", format: "volume", artists: [ref("artist-takezo", "takezo")],
      releaseDate: "2026-04-13", duration: 3120, externalUrl: "https://www.youtube.com/watch?v=fw2mtwgCeGo", artwork: { _type: "image", asset: { _type: "reference", _ref: takezoArt._id }, alt: "Redline 006 artwork" },
      genres: ["Drum + bass", "Breaks", "Footwork"], description: "A low-to-high pressure mix built around shifting drums, deep bass and the many forms that keep a floor moving.", tracks: tracklists.takezo,
      ...commonPlacement, featured: false, showInSoundroom: true, showOnHome: true, archiveSection: "volumes-residents", playerOrder: 20, soundroomOrder: 20, archiveOrder: 20, homeOrder: 20
    },
    {
      _id: "mix-lowkal-fm-vol-02", _type: "mix", title: "Meeting Point", slug: { _type: "slug", current: "lowkal-fm-vol-02" }, series: "Lowkal.fm Vol. 02", format: "volume", artists: [ref("artist-sa-rang", "sarang")],
      releaseDate: "2026-03-19", duration: 4200, externalUrl: "https://www.youtube.com/watch?v=60O126HehGA", artwork: { _type: "image", asset: { _type: "reference", _ref: sarangArt._id }, alt: "Meeting Point artwork" },
      genres: ["Footwork", "Polyrhythmic", "Bass"], description: "A fast-moving meeting point between polyrhythm, bass pressure and wide electronic space.", tracks: tracklists.sarang,
      ...commonPlacement, featured: false, showInSoundroom: true, showOnHome: true, archiveSection: "volumes-guests", playerOrder: 30, soundroomOrder: 30, archiveOrder: 30, homeOrder: 30
    },
    {
      _id: "mix-lowkal-001-takezo", _type: "mix", title: "Featured set", slug: { _type: "slug", current: "lowkal-001-takezo" }, series: "Lowkal 001 | Redline", format: "liveSet", artists: [ref("artist-takezo", "takezo")],
      releaseDate: "2026-04-13", duration: 3120, externalUrl: "https://www.youtube.com/watch?v=fw2mtwgCeGo", artwork: { _type: "image", asset: { _type: "reference", _ref: takezoArt._id }, alt: "Takezo at Lowkal 001" },
      genres: ["Drum + bass", "Breaks"], description: "The featured set from Lowkal 001, selected from the full multi-artist programme.", tracks: tracklists.takezo,
      ...commonPlacement, featured: true, showInSoundroom: false, showOnHome: false, archiveSection: "scene-programmes", playerOrder: 40, soundroomOrder: 40, archiveOrder: 40, homeOrder: 40
    },
    {
      _id: "mix-lowkal-001-sarang", _type: "mix", title: "Live set", slug: { _type: "slug", current: "lowkal-001-sarang" }, series: "Lowkal 001 | Redline", format: "liveSet", artists: [ref("artist-sa-rang", "sarang")],
      releaseDate: "2026-04-13", duration: 4200, externalUrl: "https://www.youtube.com/watch?v=60O126HehGA", artwork: { _type: "image", asset: { _type: "reference", _ref: sarangArt._id }, alt: "sa:rang at Lowkal 001" },
      genres: ["Footwork", "Polyrhythmic"], description: "A set from Lowkal 001, held inside the complete live-program record.", tracks: tracklists.sarang,
      ...commonPlacement, featured: false, showInSoundroom: false, showOnHome: false, archiveSection: "scene-programmes", playerOrder: 50, soundroomOrder: 50, archiveOrder: 50, homeOrder: 50
    }
  ];

  const programmes = [
    { _id: "programme-lowkal-002", _type: "programme", name: "Garden City Gallivanting", slug: { _type: "slug", current: "lowkal-002-garden-city-gallivanting" }, number: "002", label: "Lowkal 002 | Garden City Gallivanting", date: "2026-07-05", description: "A shared multi-genre session with Samgod, Sinhatra and Takezo.", mixes: [ref("mix-lowkal-002-garden-city-gallivanting", "session")], featuredMix: { _type: "reference", _ref: "mix-lowkal-002-garden-city-gallivanting" }, published: true, sortOrder: 10 },
    { _id: "programme-lowkal-001", _type: "programme", name: "Redline", slug: { _type: "slug", current: "lowkal-001-redline" }, number: "001", label: "Lowkal 001 | Redline", date: "2026-04-13", description: "A multi-artist live programme. Each Lowkal programme keeps every set together and marks one set as the featured recording.", mixes: [ref("mix-lowkal-001-takezo", "takezo"), ref("mix-lowkal-001-sarang", "sarang")], featuredMix: { _type: "reference", _ref: "mix-lowkal-001-takezo" }, published: true, sortOrder: 20 }
  ];

  const transaction = client.transaction();
  for (const document of [...artists, ...mixes, ...programmes]) transaction.createIfNotExists(document);
  await transaction.commit();
  console.log(`Listen migration complete: ${artists.length} artists, ${mixes.length} mixes, ${programmes.length} programmes.`);
}

await main();
