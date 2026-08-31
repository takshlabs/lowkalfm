import { defineConfig } from "sanity";
import { structureTool, type StructureResolver } from "sanity/structure";
import { schemaTypes } from "@/sanity/schemaTypes";

const configuredProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
export const isSanityStudioConfigured = Boolean(configuredProjectId);

const projectId = configuredProjectId || "placeholder";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

const structure: StructureResolver = (S) => S.list()
  .title("Lowkal CMS")
  .items([
    S.listItem().title("Listen").child(S.list().title("Listen").items([
      S.documentTypeListItem("mix").title("Mixes"),
      S.documentTypeListItem("programme").title("Programmes"),
      S.documentTypeListItem("artist").title("Artists")
    ])),
    S.divider(),
    S.listItem().title("Read").child(S.list().title("Read").items([
      S.documentTypeListItem("editorialStory").title("Stories"),
      S.documentTypeListItem("author").title("Authors"),
      S.documentTypeListItem("topic").title("Topics")
    ])),
    S.divider(),
    S.documentTypeListItem("siteSettings").title("Site settings")
  ]);

export default defineConfig({
  name: "lowkal",
  title: "Lowkal CMS",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [structureTool({ structure })],
  schema: { types: schemaTypes }
});
