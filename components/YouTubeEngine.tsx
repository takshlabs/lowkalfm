"use client";

import type { ComponentType } from "react";
import { createElement, useEffect, useState } from "react";
import type { YouTubeEvent, YouTubeProps } from "react-youtube";

type YouTubeEngineProps = {
  videoId: string;
  opts: YouTubeProps["opts"];
  onReady: (event: YouTubeEvent) => void;
  onStateChange: (event: YouTubeEvent) => void;
};

/**
 * The hidden frame that actually produces sound.
 *
 * react-youtube reaches a dependency that calls require("tty") the moment the
 * module is evaluated. That call has no meaning in the worker runtime and
 * throws, which used to break the server render of every page on the site.
 * Importing the module from inside an effect keeps it out of the server pass
 * completely, and playback is unchanged because the frame is only ever useful
 * in a browser.
 *
 * The loaded module is held in state and rendered through createElement rather
 * than as JSX, because the value is a module reference rather than a component
 * this render created.
 */
export function YouTubeEngine({ videoId, opts, onReady, onStateChange }: YouTubeEngineProps) {
  const [frame, setFrame] = useState<ComponentType<YouTubeProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("react-youtube").then((module) => {
      if (!cancelled) setFrame(() => module.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="youtube-engine" aria-hidden="true">
      {frame ? createElement(frame, { key: videoId, videoId, opts, onReady, onStateChange }) : null}
    </div>
  );
}
