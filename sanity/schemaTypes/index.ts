import type { SchemaTypeDefinition } from "sanity";
import { authorType } from "@/sanity/schemaTypes/authorType";
import { artistType } from "@/sanity/schemaTypes/artistType";
import { editorialStoryType } from "@/sanity/schemaTypes/editorialStoryType";
import { mixType } from "@/sanity/schemaTypes/mixType";
import { programmeType } from "@/sanity/schemaTypes/programmeType";
import { siteSettingsType } from "@/sanity/schemaTypes/siteSettingsType";
import { topicType } from "@/sanity/schemaTypes/topicType";

export const schemaTypes: SchemaTypeDefinition[] = [mixType, programmeType, artistType, editorialStoryType, authorType, topicType, siteSettingsType];
