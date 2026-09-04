export type MixPlaybackInput = {
  deliveryUrl?: string;
  masterUrl?: string;
  externalUrl?: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function getYouTubeVideoId(externalUrl?: string) {
  if (!externalUrl) return undefined;
  try {
    const url = new URL(externalUrl);
    let candidate: string | null | undefined;
    if (url.hostname === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0];
    else if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") candidate = url.searchParams.get("v");
      else {
        const [kind, id] = url.pathname.split("/").filter(Boolean);
        if (kind === "embed" || kind === "shorts" || kind === "live") candidate = id;
      }
    }
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : undefined;
  } catch { return undefined; }
}

export function getMixStartOffset(startOffset?: number) {
  return Number.isFinite(startOffset) ? Math.max(0, Number(startOffset)) : 0;
}

export function resolveMixPlayback({ deliveryUrl, masterUrl, externalUrl }: MixPlaybackInput) {
  return {
    audioUrl: deliveryUrl || masterUrl || undefined,
    youtubeId: getYouTubeVideoId(externalUrl),
  };
}
