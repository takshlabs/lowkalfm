import { getYouTubeVideoId } from "./audio-source.ts";

const LOCAL_HOSTS = new Set([
  "lowkal.fm",
  "www.lowkal.fm",
  "lowkalfm.in",
  "www.lowkalfm.in",
  "lowkalfm.vercel.app",
  "localhost",
  "127.0.0.1"
]);

const YOUTUBE_THUMB_FILES = ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"] as const;

export type DeskLink = {
  title: string;
  url: string;
  label?: string;
  description?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  youtubeId?: string;
};

export type DeskBoard = {
  title: string;
  kicker: string;
  intro: string;
  links: DeskLink[];
};

export type DeskBoardRecord = {
  title?: string | null;
  kicker?: string | null;
  intro?: string | null;
  links?: Array<{
    title?: string | null;
    url?: string | null;
    label?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
  }> | null;
} | null;

export function deskPreviewSources(link: Pick<DeskLink, "imageUrl" | "youtubeId">) {
  const sources: string[] = [];
  if (link.imageUrl) sources.push(link.imageUrl);
  if (link.youtubeId) {
    for (const file of YOUTUBE_THUMB_FILES) sources.push(`https://i.ytimg.com/vi/${link.youtubeId}/${file}`);
  }
  return sources;
}

export function isAllowedDeskUrl(url: string) {
  const value = url.trim();
  if (!value) return false;
  if (value.startsWith("mailto:")) return value.length > 7 && !/\s/.test(value);

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) return false;
    return true;
  } catch {
    return false;
  }
}

export function deskLinkHost(url: string) {
  if (url.startsWith("mailto:")) return url.slice("mailto:".length);
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function toDeskBoard(board: DeskBoardRecord): DeskBoard {
  return {
    title: board?.title?.trim() || "Lowkal",
    kicker: board?.kicker?.trim() || "From Bengaluru",
    intro: board?.intro?.trim() || "",
    links: (board?.links ?? []).flatMap((link) => {
      const title = link?.title?.trim() ?? "";
      const url = link?.url?.trim() ?? "";
      if (!title || !url || !isAllowedDeskUrl(url)) return [];
      return [{
        title,
        url,
        label: link.label?.trim() || undefined,
        description: link.description?.trim() || undefined,
        imageUrl: link.imageUrl,
        imageAlt: link.imageAlt?.trim() || title,
        youtubeId: getYouTubeVideoId(url)
      }];
    })
  };
}
