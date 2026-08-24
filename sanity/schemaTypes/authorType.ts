import { defineField, defineType } from "sanity";

export const authorType = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "name" }, validation: (rule) => rule.required() }),
    defineField({ name: "role", title: "Role", type: "string" }),
    defineField({ name: "bio", title: "Bio", type: "text", rows: 4 }),
    defineField({ name: "portrait", title: "Portrait", type: "image", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Description", type: "string" })] })
  ],
  preview: { select: { title: "name", subtitle: "role", media: "portrait" } }
});
