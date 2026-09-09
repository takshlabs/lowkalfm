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
