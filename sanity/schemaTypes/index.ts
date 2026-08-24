import type { SchemaTypeDefinition } from "sanity";
import { authorType } from "@/sanity/schemaTypes/authorType";
import { editorialStoryType } from "@/sanity/schemaTypes/editorialStoryType";
import { siteSettingsType } from "@/sanity/schemaTypes/siteSettingsType";
import { topicType } from "@/sanity/schemaTypes/topicType";

export const schemaTypes: SchemaTypeDefinition[] = [editorialStoryType, authorType, topicType, siteSettingsType];
