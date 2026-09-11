/** Reject invalid commands. An unknown duration must not erase a queued seek. */
export function boundPlaybackTime(seconds: number, duration: number): number | null {
  if (!Number.isFinite(seconds)) return null;
  return Math.min(Number.isFinite(duration) && duration > 0 ? duration : Infinity, Math.max(0, seconds));
}

/** Invalidate promise callbacks synchronously, before React renders. */
export function createPlaybackRequests() {
  let generation = 0;
  return {
    begin: () => ++generation,
    cancel: () => { generation += 1; },
    isCurrent: (request: number) => request === generation,
  };
}

export type RepeatMode = "off" | "all" | "one";
export type PlaybackClaim = { timestamp: number; sequence: number; tabId: string };

export const PLAYBACK_CLAIM_STORAGE_KEY = "lowkal.playback.claim.v1";
export const PLAYBACK_ACTIVITY_STORAGE_KEY = "lowkal.playback.active.v1";

export function comparePlaybackClaims(first: PlaybackClaim, second: PlaybackClaim) {
  if (first.timestamp !== second.timestamp) return first.timestamp < second.timestamp ? -1 : 1;
  if (first.sequence !== second.sequence) return first.sequence < second.sequence ? -1 : 1;
  return first.tabId === second.tabId ? 0 : first.tabId < second.tabId ? -1 : 1;
}

export function nextQueueIndex(currentIndex: number, length: number, repeatMode: RepeatMode): number | null {
  if (length <= 0 || currentIndex < 0 || currentIndex >= length) return null;
  if (currentIndex + 1 < length) return currentIndex + 1;
  return repeatMode === "all" ? 0 : null;
}

export function previousQueueIndex(currentIndex: number, length: number, repeatMode: RepeatMode): number | null {
  if (length <= 0 || currentIndex < 0 || currentIndex >= length) return null;
  if (currentIndex > 0) return currentIndex - 1;
  return repeatMode === "all" ? length - 1 : null;
}

export function endedQueueIndex(currentIndex: number, length: number, repeatMode: RepeatMode): number | null {
  return repeatMode === "one" ? currentIndex : nextQueueIndex(currentIndex, length, repeatMode);
}

export function shouldRestartPrevious(currentTime: number, startOffset = 0, threshold = 3) {
  return Number.isFinite(currentTime) && currentTime - startOffset > threshold;
}

export function createShuffleOrder(slugs: string[], currentSlug: string, random = Math.random) {
  const unique = [...new Set(slugs)];
  const remaining = unique.filter((slug) => slug !== currentSlug);
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.min(0.999999, Math.max(0, random())) * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }
  return unique.includes(currentSlug) ? [currentSlug, ...remaining] : remaining;
}
