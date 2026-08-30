"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { sitePath } from "@/lib/site-path";
import { useListenContent } from "./ListenContentProvider";

const NAVIGATION_CHANNEL = "lowkal.navigation.v1";
const CATALOG_CHANNEL = "lowkal.catalog.v1";

export function SoundroomFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { records, getArtist } = useListenContent();
  const mixes = useMemo(() => records.filter((record) => record.showInSoundroom).map((record, index) => {
    const artist = record.artistSlugs[0] ? getArtist(record.artistSlugs[0]) : undefined;
    const positions = [{ top: 20, left: 15 }, { top: 50, left: 60 }, { top: 14, left: 76 }, { top: 68, left: 30 }];
    const basePos = positions[index % positions.length];
    return {
      id: record.slug,
      title: record.title,
      dj: record.artist,
      date: record.date,
      genre: record.genres.join(" / ") || "Lowkal",
      youtubeId: record.youtubeId,
      artUrl: record.artwork,
      description: record.description,
      artistBio: artist?.shortBio || "Open the artist page for more information.",
      artistUrl: artist ? sitePath(`/artists/${artist.slug}`) : "",
      duration: record.duration,
      synthStyle: "live",
      tracks: record.tracks,
      cloud: {
        size: index === 0 ? 350 : index === 1 ? 250 : 190,
        speedClass: index === 0 ? "fast" : "med",
        zIndex: Math.max(10, 30 - index * 5),
        basePos,
        vx: index % 2 === 0 ? 0.2 : -0.16,
        vy: index % 2 === 0 ? -0.12 : 0.1
      }
    };
  }), [getArtist, records]);

  const sendCatalog = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ channel: CATALOG_CHANNEL, type: "catalog", mixes }, window.location.origin);
  }, [mixes]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as { channel?: string; type?: string; href?: string } | null;
      if (!message || message.channel !== NAVIGATION_CHANNEL || message.type !== "navigate" || !message.href) return;

      const destination = new URL(message.href, window.location.origin);
      if (destination.origin !== window.location.origin) return;
      window.location.assign(`${destination.pathname}${destination.search}${destination.hash}`);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    sendCatalog();
  }, [sendCatalog]);

  return (
    <iframe
      ref={frameRef}
      src={sitePath("/soundroom/index.html")}
      title="Lowkal Soundroom"
      onLoad={sendCatalog}
      style={{ display: "block", width: "100%", height: "100%", border: 0 }}
    />
  );
}
