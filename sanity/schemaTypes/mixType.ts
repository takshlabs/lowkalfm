import { defineArrayMember, defineField, defineType } from "sanity";

export const mixType = defineType({
  name: "mix",
  title: "Mix",
  type: "document",
  groups: [
    { name: "identity", title: "Mix", default: true },
    { name: "playback", title: "Playback" },
    { name: "placement", title: "Placement" },
    { name: "tracklist", title: "Tracklist" }
  ],
  fields: [
    defineField({ name: "title", title: "Mix title", type: "string", group: "identity", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Mix URL", type: "slug", group: "identity", options: { source: "title", maxLength: 96 }, validation: (rule) => rule.required() }),
    defineField({ name: "series", title: "Series or programme label", type: "string", group: "identity", validation: (rule) => rule.required() }),
    defineField({
      name: "format",
      title: "Format",
      type: "string",
      group: "identity",
      options: { list: [
        { title: "FM volume", value: "volume" },
        { title: "Live set", value: "liveSet" },
        { title: "Full session", value: "fullSession" }
      ], layout: "radio" },
      initialValue: "volume",
      validation: (rule) => rule.required()
    }),
    defineField({ name: "artists", title: "Artists", type: "array", group: "identity", of: [defineArrayMember({ type: "reference", to: [{ type: "artist" }] })] }),
    defineField({ name: "artistDisplayName", title: "Artist line override", type: "string", group: "identity", description: "Use this for a B2B or multi-artist credit. Leave it empty to use the linked artist names." }),
    defineField({ name: "releaseDate", title: "Release date", type: "date", group: "identity", validation: (rule) => rule.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 5, group: "identity" }),
    defineField({ name: "genres", title: "Genres", type: "array", group: "identity", of: [defineArrayMember({ type: "string" })], options: { layout: "tags" } }),
    defineField({ name: "artwork", title: "Artwork", type: "image", group: "identity", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })], validation: (rule) => rule.required() }),
    defineField({ name: "thumbnail", title: "Optional thumbnail", type: "image", group: "identity", description: "Use only when a surface needs a separate crop.", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] }),
    defineField({ name: "youtubeId", title: "YouTube video ID", type: "string", group: "playback", description: "Use only the video ID, not the full URL.", validation: (rule) => rule.required() }),
    defineField({ name: "externalUrl", title: "Original mix link", type: "url", group: "playback" }),
    defineField({ name: "duration", title: "Duration in seconds", type: "number", group: "playback", validation: (rule) => rule.required().integer().positive() }),
    defineField({ name: "published", title: "Published", type: "boolean", group: "placement", initialValue: false }),
    defineField({ name: "featured", title: "Featured mix", type: "boolean", group: "placement", initialValue: false }),
    defineField({ name: "showInPlayer", title: "Available in player", type: "boolean", group: "placement", initialValue: true }),
    defineField({ name: "playerOrder", title: "Player order", type: "number", group: "placement", initialValue: 100 }),
    defineField({ name: "showInSoundroom", title: "Show in Soundroom", type: "boolean", group: "placement", initialValue: true }),
    defineField({ name: "soundroomOrder", title: "Soundroom order", type: "number", group: "placement", initialValue: 100 }),
    defineField({ name: "showInArchive", title: "Show in Archive", type: "boolean", group: "placement", initialValue: true }),
    defineField({
      name: "archiveSection",
      title: "Archive section",
      type: "string",
      group: "placement",
      options: { list: [
        { title: "Scene programmes", value: "scene-programmes" },
        { title: "Resident volumes", value: "volumes-residents" },
        { title: "Guest volumes", value: "volumes-guests" }
      ] },
      initialValue: "volumes-guests"
    }),
    defineField({ name: "archiveOrder", title: "Archive order", type: "number", group: "placement", initialValue: 100 }),
    defineField({ name: "showOnHome", title: "Show on home", type: "boolean", group: "placement", initialValue: true }),
    defineField({ name: "homeOrder", title: "Home order", type: "number", group: "placement", initialValue: 100 }),
    defineField({
      name: "tracks",
      title: "Tracks",
      type: "array",
      group: "tracklist",
      of: [defineArrayMember({
        name: "track",
        title: "Track",
        type: "object",
        fields: [
          defineField({ name: "time", title: "Start time in seconds", type: "number", validation: (rule) => rule.required().integer().min(0) }),
          defineField({ name: "title", title: "Track title", type: "string", validation: (rule) => rule.required() }),
          defineField({ name: "artist", title: "Track artist", type: "string", validation: (rule) => rule.required() })
        ],
        preview: { select: { title: "title", subtitle: "artist" } }
      })]
    })
  ],
  orderings: [
    { title: "Release date, new first", name: "releaseDateDesc", by: [{ field: "releaseDate", direction: "desc" }] },
    { title: "Soundroom order", name: "soundroomOrder", by: [{ field: "soundroomOrder", direction: "asc" }] }
  ],
  preview: {
    select: { title: "title", series: "series", artist: "artistDisplayName", media: "artwork", published: "published" },
    prepare: ({ title, series, artist, media, published }) => ({ title, subtitle: `${published ? "Published" : "Draft"} · ${artist || series}`, media })
  }
});
