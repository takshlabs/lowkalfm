"use client";

import { useEffect } from "react";

/**
 * Reveals every element marked with data-reveal once it enters the viewport.
 *
 * The hook first adds a `js` class to the document element. The stylesheet
 * hides reveal targets only under that class, so a visitor without JavaScript
 * sees the full page instead of an empty one.
 *
 * Elements inside a [data-reveal-group] receive an incrementing
 * --reveal-index, which the stylesheet turns into a stagger delay.
 */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const groups = document.querySelectorAll<HTMLElement>("[data-reveal-group]");
    groups.forEach((group) => {
      Array.from(group.children).forEach((child, index) => {
        (child as HTMLElement).style.setProperty("--reveal-index", String(index));
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          // A reveal plays once. Releasing the target keeps the observer small.
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    const targets = document.querySelectorAll("[data-reveal]");
    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, []);
}
