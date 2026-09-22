"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sitePath } from "@/lib/site-path";

type MixShareButtonProps = {
  slug: string;
  title: string;
  variant: "player" | "archive" | "artist";
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy failed");
}

export function MixShareButton({ slug, title, variant }: MixShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  const copyLink = async () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    try {
      const encodedSlug = encodeURIComponent(slug);
      const path = variant === "player"
        ? sitePath(`/?mix=${encodedSlug}`)
        : sitePath(`/listen/archive/${encodedSlug}`);
      await copyText(new URL(path, window.location.origin).toString());
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2200);
  };

  const feedback = status === "copied" ? "Copied" : status === "error" ? "Try again" : "Copy link";

  return (
    <button
      type="button"
      className={`mix-share-button mix-share-button--${variant}`}
      onClick={copyLink}
      aria-label={`${feedback} for ${title}`}
      title={`${feedback} for ${title}`}
      data-state={status}
    >
      {status === "copied" ? <Check className="lowkal-icon" aria-hidden="true" /> : <Share2 className="lowkal-icon" aria-hidden="true" />}
      <span aria-hidden="true">{feedback}</span>
      <span className="sr-only" aria-live="polite">{status === "copied" ? `Link copied for ${title}` : status === "error" ? `Could not copy the link for ${title}` : ""}</span>
    </button>
  );
}
