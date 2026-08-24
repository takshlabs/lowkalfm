import { defineConfig } from "sanity";
import { schemaTypes } from "@/sanity/schemaTypes";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export default defineConfig({
  name: "lowkal",
  title: "Lowkal Editorial",
  projectId,
  dataset,
  basePath: "/studio",
  schema: { types: schemaTypes }
});
