import { defineArrayMember, defineField, defineType } from "sanity";

const imageFields = [defineField({ name: "alt", title: "Description", type: "string", validation: (rule) => rule.required() })];

export const editorialStoryType = defineType({
  name: "editorialStory",
  title: "Editorial story",
  type: "document",
  groups: [{ name: "story", title: "Story", default: true }, { name: "details", title: "Details" }, { name: "sharing", title: "Sharing" }],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "story", validation: (rule) => rule.required().max(120) }),
    defineField({ name: "slug", title: "URL", type: "slug", group: "story", options: { source: "title", maxLength: 96 }, validation: (rule) => rule.required() }),
    defineField({ name: "deck", title: "Deck", type: "text", rows: 3, group: "story", validation: (rule) => rule.required().max(360) }),
    defineField({ name: "coverImage", title: "Cover image", type: "image", group: "story", options: { hotspot: true }, fields: imageFields }),
    defineField({ name: "body", title: "Story", type: "array", group: "story", validation: (rule) => rule.required(), of: [
      defineArrayMember({ type: "block", styles: [{ title: "Normal", value: "normal" }, { title: "Heading", value: "h2" }, { title: "Subheading", value: "h3" }, { title: "Quote", value: "blockquote" }], lists: [{ title: "Bullet", value: "bullet" }, { title: "Number", value: "number" }], marks: { decorators: [{ title: "Strong", value: "strong" }, { title: "Emphasis", value: "em" }, { title: "Code", value: "code" }], annotations: [{ name: "link", type: "object", title: "Link", fields: [defineField({ name: "href", title: "URL", type: "url", validation: (rule) => rule.required() })] }] } }),
      defineArrayMember({ type: "image", options: { hotspot: true }, fields: imageFields }),
      defineArrayMember({ name: "pullQuote", title: "Pull quote", type: "object", fields: [defineField({ name: "quote", title: "Quote", type: "text", rows: 3, validation: (rule) => rule.required() }), defineField({ name: "attribution", title: "Attribution", type: "string" })], preview: { select: { title: "quote", subtitle: "attribution" } } }),
      defineArrayMember({ name: "audioEmbed", title: "Audio embed", type: "object", fields: [defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }), defineField({ name: "url", title: "Audio URL", type: "url", validation: (rule) => rule.required() }), defineField({ name: "captionsUrl", title: "Captions URL", type: "url", description: "Optional WebVTT captions file." }), defineField({ name: "caption", title: "Caption", type: "string" })], preview: { select: { title: "title", subtitle: "url" } } }),
      defineArrayMember({ name: "callout", title: "Callout", type: "object", fields: [defineField({ name: "heading", title: "Heading", type: "string" }), defineField({ name: "text", title: "Text", type: "text", rows: 4, validation: (rule) => rule.required() })], preview: { select: { title: "heading", subtitle: "text" } } })
    ] }),
    defineField({ name: "format", title: "Format", type: "string", group: "details", description: "Use any format name. For example: Interview, Field note, Photo essay, or Playlist.", initialValue: "Editorial" }),
    defineField({ name: "authors", title: "Authors", type: "array", group: "details", of: [{ type: "reference", to: [{ type: "author" }] }] }),
    defineField({ name: "byline", title: "Byline override", type: "string", group: "details", description: "Use only if this story has no listed author." }),
    defineField({ name: "topics", title: "Topics", type: "array", group: "details", of: [{ type: "reference", to: [{ type: "topic" }] }] }),
    defineField({ name: "publishedAt", title: "Publish date", type: "datetime", group: "details", initialValue: () => new Date().toISOString(), validation: (rule) => rule.required() }),
    defineField({ name: "accent", title: "Accent", type: "string", group: "details", options: { list: ["paper", "red", "signal", "ink"], layout: "radio" }, initialValue: "paper" }),
    defineField({ name: "details", title: "Flexible details", type: "array", group: "details", description: "Add labels and values as each story changes.", of: [{ type: "object", fields: [defineField({ name: "label", title: "Label", type: "string", validation: (rule) => rule.required() }), defineField({ name: "value", title: "Value", type: "string", validation: (rule) => rule.required() })], preview: { select: { title: "label", subtitle: "value" } } }] }),
    defineField({ name: "seoTitle", title: "Sharing title", type: "string", group: "sharing", validation: (rule) => rule.max(70) }),
    defineField({ name: "seoDescription", title: "Sharing description", type: "text", rows: 3, group: "sharing", validation: (rule) => rule.max(160) })
  ],
  preview: { select: { title: "title", subtitle: "format", media: "coverImage" } }
});
