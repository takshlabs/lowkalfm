"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sitePath } from "@/lib/site-path";

const NAVIGATION_CHANNEL = "lowkal.navigation.v1";

export function SoundroomFrame() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as { channel?: string; type?: string; href?: string } | null;
      if (!message || message.channel !== NAVIGATION_CHANNEL || message.type !== "navigate" || !message.href) return;

      const destination = new URL(message.href, window.location.origin);
      if (destination.origin !== window.location.origin) return;
      router.push(`${destination.pathname}${destination.search}${destination.hash}`);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  return (
    <iframe
      ref={frameRef}
      src={sitePath("/soundroom/index.html")}
      title="Lowkal Soundroom"
      style={{ display: "block", width: "100%", height: "100%", border: 0 }}
    />
  );
}
