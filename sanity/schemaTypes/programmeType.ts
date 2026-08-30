import { defineArrayMember, defineField, defineType } from "sanity";

export const programmeType = defineType({
  name: "programme",
  title: "Programme",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Programme name", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Programme URL", type: "slug", options: { source: "name", maxLength: 96 }, validation: (rule) => rule.required() }),
    defineField({ name: "number", title: "Programme number", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "label", title: "Full label", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "date", title: "Date", type: "date", validation: (rule) => rule.required() }),
    defineField({ name: "description", title: "Description", type: "text", rows: 4 }),
    defineField({ name: "mixes", title: "Mixes", type: "array", of: [defineArrayMember({ type: "reference", to: [{ type: "mix" }] })] }),
    defineField({ name: "featuredMix", title: "Featured mix", type: "reference", to: [{ type: "mix" }] }),
    defineField({ name: "published", title: "Show programme", type: "boolean", initialValue: false }),
    defineField({ name: "sortOrder", title: "Programme order", type: "number", initialValue: 100 })
  ],
  preview: { select: { title: "name", number: "number", date: "date" }, prepare: ({ title, number, date }) => ({ title: `Lowkal ${number} · ${title}`, subtitle: date }) }
});
