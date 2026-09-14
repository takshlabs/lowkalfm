import { defineArrayMember, defineField, defineType } from "sanity";

function bioWordLimit(value: unknown) {
  if (!Array.isArray(value)) return true;
  const text = value.flatMap((block) => (
    block && typeof block === "object" && "children" in block && Array.isArray(block.children)
      ? block.children.map((child: unknown) => child && typeof child === "object" && "text" in child ? String(child.text) : "")
      : []
  )).join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length <= 200 || "Keep the artist bio to 200 words or fewer.";
}

export const artistType = defineType({
  name: "artist",
  title: "Artist",
  type: "document",
  groups: [
    { name: "profile", title: "Profile", default: true },
    { name: "listening", title: "Mixes and productions" },
    { name: "city", title: "Field notes" },
    { name: "links", title: "Links" },
    { name: "publishing", title: "Publishing" }
  ],
  fields: [
    defineField({ name: "name", title: "Artist name", type: "string", group: "profile", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Public URL", type: "slug", group: "profile", options: { source: "name", maxLength: 96 }, validation: (rule) => rule.required() }),
    defineField({
      name: "relationship",
      title: "Lowkal relationship",
      type: "string",
      group: "profile",
      options: { list: [
        { title: "Resident", value: "resident" },
        { title: "Guest", value: "guest" },
        { title: "Collective", value: "collective" },
        { title: "Other", value: "other" }
      ], layout: "radio" },
      initialValue: "guest",
      validation: (rule) => rule.required()
    }),
    defineField({ name: "location", title: "Location", type: "string", group: "profile" }),
    defineField({ name: "genres", title: "Genres", type: "array", group: "profile", of: [defineArrayMember({ type: "string" })], options: { layout: "tags" } }),
    defineField({ name: "shortBio", title: "Short bio", type: "text", rows: 3, group: "profile", description: "Used on lists and compact artist cards." }),
    defineField({
      name: "bio",
      title: "Full bio",
      type: "array",
      group: "profile",
      of: [defineArrayMember({ type: "block" })],
      validation: (rule) => rule.custom(bioWordLimit)
    }),
    defineField({ name: "portrait", title: "Portrait", type: "image", group: "profile", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] }),
    defineField({ name: "coverImage", title: "Wide profile image", type: "image", group: "profile", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] }),
    defineField({ name: "featuredMix", title: "Featured Lowkal mix", type: "reference", group: "listening", to: [{ type: "mix" }], description: "This mix appears in the focused artist player." }),
    defineField({
      name: "externalMixes",
      title: "Mixes outside Lowkal",
      type: "array",
      group: "listening",
      of: [defineArrayMember({
        name: "externalMix",
        title: "External mix",
        type: "object",
        fields: [
          defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
          defineField({ name: "platform", title: "Platform", type: "string", options: { list: ["SoundCloud", "Mixcloud", "YouTube", "Spotify", "Other"] }, validation: (rule) => rule.required() }),
          defineField({ name: "url", title: "Mix URL", type: "url", validation: (rule) => rule.required() }),
          defineField({ name: "note", title: "Short note", type: "string", validation: (rule) => rule.max(140) }),
          defineField({ name: "artwork", title: "Artwork", type: "image", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] })
        ],
        preview: { select: { title: "title", subtitle: "platform", media: "artwork" } }
      })]
    }),
    defineField({
      name: "productions",
      title: "Productions and releases",
      type: "array",
      group: "listening",
      description: "Leave this empty when the artist is not a producer.",
      of: [defineArrayMember({
        name: "production",
        title: "Production",
        type: "object",
        fields: [
          defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
          defineField({ name: "releaseType", title: "Release type", type: "string", options: { list: ["Track", "EP", "Album", "Remix", "Compilation"] }, validation: (rule) => rule.required() }),
          defineField({ name: "year", title: "Year", type: "number", validation: (rule) => rule.integer().min(1900).max(2100) }),
          defineField({ name: "spotifyUrl", title: "Spotify URL", type: "url", description: "Adds an embedded Spotify player." }),
          defineField({ name: "externalUrl", title: "Other release URL", type: "url" }),
          defineField({ name: "artwork", title: "Artwork", type: "image", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] })
        ],
        preview: { select: { title: "title", type: "releaseType", year: "year", media: "artwork" }, prepare: ({ title, type, year, media }) => ({ title, subtitle: [type, year].filter(Boolean).join(" · "), media }) }
      })]
    }),
    defineField({
      name: "fieldNotes",
      title: "City field notes",
      type: "array",
      group: "city",
      description: "Places the artist returns to. A Go Out slug can connect this note to a future venue page.",
      of: [defineArrayMember({
        name: "fieldNote",
        title: "Field note",
        type: "object",
        fields: [
          defineField({ name: "placeName", title: "Place", type: "string", validation: (rule) => rule.required() }),
          defineField({ name: "area", title: "Area or neighbourhood", type: "string" }),
          defineField({ name: "note", title: "Artist note", type: "text", rows: 3, validation: (rule) => rule.required().max(280) }),
          defineField({ name: "tags", title: "Tags", type: "array", of: [defineArrayMember({ type: "string" })], options: { layout: "tags" } }),
          defineField({ name: "mapUrl", title: "Map URL", type: "url" }),
          defineField({ name: "goOutSlug", title: "Go Out slug", type: "slug", description: "Optional shared ID for the Go Out guide." })
        ],
        preview: { select: { title: "placeName", subtitle: "area" } }
      })]
    }),
    defineField({
      name: "links",
      title: "Artist links",
      type: "array",
      group: "links",
      of: [defineArrayMember({
        name: "artistLink",
        title: "Link",
        type: "object",
        fields: [
          defineField({ name: "label", title: "Label", type: "string", validation: (rule) => rule.required() }),
          defineField({ name: "url", title: "URL", type: "url", validation: (rule) => rule.required() })
        ],
        preview: { select: { title: "label", subtitle: "url" } }
      })]
    }),
    defineField({ name: "published", title: "Show artist page", type: "boolean", group: "publishing", initialValue: false }),
    defineField({ name: "sortOrder", title: "Artist order", type: "number", group: "publishing", initialValue: 100 })
  ],
  preview: { select: { title: "name", subtitle: "relationship", media: "portrait" } }
});
