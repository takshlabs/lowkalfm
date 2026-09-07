import { defineArrayMember, defineField, defineType } from "sanity";

export const linkBoardType = defineType({
  name: "linkBoard",
  title: "Private links",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Page title",
      type: "string",
      initialValue: "Lowkal",
      validation: (rule) => rule.required()
    }),
    defineField({
      name: "kicker",
      title: "Kicker",
      type: "string",
      initialValue: "From Bengaluru",
      description: "A short line above the title. For example: From Bengaluru."
    }),
    defineField({
      name: "intro",
      title: "Introduction",
      type: "text",
      rows: 3
    }),
    defineField({
      name: "published",
      title: "Publish this desk",
      type: "boolean",
      initialValue: false,
      description: "Share the /desk link privately. This page is not in the site navigation and search engines do not index it. Turn this on to show the published links."
    }),
    defineField({
      name: "links",
      title: "Links",
      type: "array",
      description: "Add external destinations in the order they should appear. Do not add Lowkal site pages.",
      of: [defineArrayMember({
        name: "deskLink",
        title: "Link",
        type: "object",
        fields: [
          defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
          defineField({
            name: "url",
            title: "URL",
            type: "url",
            description: "Use an external http, https, or mailto address. Lowkal site pages are removed from the desk.",
            validation: (rule) => rule.required().uri({ scheme: ["http", "https", "mailto"] })
          }),
          defineField({
            name: "label",
            title: "Label",
            type: "string",
            description: "A short marker such as Tickets, Mix, or Instagram."
          }),
          defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
          defineField({
            name: "preview",
            title: "Preview image",
            type: "image",
            options: { hotspot: true },
            fields: [defineField({ name: "alt", title: "Description", type: "string" })]
          }),
          defineField({
            name: "parked",
            title: "Park this link",
            type: "boolean",
            initialValue: false,
            description: "Hide this published link from the private desk. It stays in the CMS and can be restored at any time."
          })
        ],
        preview: {
          select: { title: "title", subtitle: "url", media: "preview", parked: "parked" },
          prepare: ({ title, subtitle, media, parked }) => ({
            title,
            subtitle: `${parked ? "Parked" : "Visible"} · ${subtitle || ""}`,
            media
          })
        }
      })]
    })
  ],
  preview: { prepare: () => ({ title: "Private links" }) }
});
