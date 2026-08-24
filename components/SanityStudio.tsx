"use client";

import { Studio } from "sanity";
import config from "@/sanity.config";
import "sanity/bundle.css";

export function SanityStudio() {
  return <main className="sanity-studio"><Studio config={config} /></main>;
}
