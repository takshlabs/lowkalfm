import { defineArrayMember, defineField, defineType } from "sanity";

export const artistType = defineType({
  name: "artist",
  title: "Artist",
  type: "document",
  groups: [
    { name: "profile", title: "Profile", default: true },
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
      of: [defineArrayMember({ type: "block" })]
    }),
    defineField({ name: "portrait", title: "Portrait", type: "image", group: "profile", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] }),
    defineField({ name: "coverImage", title: "Wide profile image", type: "image", group: "profile", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] }),
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
