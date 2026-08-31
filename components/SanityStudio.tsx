"use client";

import { Studio } from "sanity";
import config, { isSanityStudioConfigured } from "@/sanity.config";
import "sanity/bundle.css";

export function SanityStudio() {
  if (!isSanityStudioConfigured) {
    return (
      <main className="sanity-studio">
        <p>Sanity Studio is not available in this deployment.</p>
      </main>
    );
  }

  return <main className="sanity-studio"><Studio config={config} /></main>;
}
