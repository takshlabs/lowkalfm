"use client";

import { useReveal } from "@/lib/use-reveal";

/**
 * Client-side chrome that has no markup of its own.
 *
 * It marks the document as JavaScript-capable and starts the scroll-reveal
 * observer. Keeping this in one small component lets the layout and every
 * page below it stay a server component.
 */
export function SiteChrome() {
  useReveal();
  return null;
}
