import { defineField, defineType } from "sanity";

export const siteSettingsType = defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", initialValue: "Lowkal" }),
    defineField({ name: "editorialIntro", title: "Read introduction", type: "text", rows: 3 }),
    defineField({ name: "fields", title: "Flexible site fields", type: "array", description: "Use named values for future site content without changing the publishing model.", of: [{ type: "object", fields: [defineField({ name: "key", title: "Key", type: "string", validation: (rule) => rule.required() }), defineField({ name: "value", title: "Value", type: "text", rows: 3, validation: (rule) => rule.required() })], preview: { select: { title: "key", subtitle: "value" } } }] })
  ],
  preview: { prepare: () => ({ title: "Site settings" }) }
});
