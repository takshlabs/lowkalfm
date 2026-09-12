"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type HorizontalContentRailProps = {
  ariaLabel: string;
  className: string;
  children: ReactNode;
};

export function HorizontalContentRail({ ariaLabel, className, children }: HorizontalContentRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canGoBack: false, canGoForward: false });

  const syncScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    setScrollState({
      canGoBack: rail.scrollLeft > 1,
      canGoForward: rail.scrollLeft < maxScrollLeft - 1
    });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    syncScrollState();
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(rail);
    rail.addEventListener("scroll", syncScrollState, { passive: true });
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", syncScrollState);
    };
  }, [children, syncScrollState]);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.max(rail.clientWidth * 0.82, 280),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
    });
  };


  return (
    <div className="horizontal-content-rail">
      <div className="horizontal-content-rail-controls" aria-label={`${ariaLabel} navigation`}>
        <button type="button" onClick={() => move(-1)} disabled={!scrollState.canGoBack} aria-label={`Previous ${ariaLabel}`}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" onClick={() => move(1)} disabled={!scrollState.canGoForward} aria-label={`Next ${ariaLabel}`}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div ref={railRef} className={className} role="region" aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  );
}
