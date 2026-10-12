// Local backfills read the complete master in order, with a bounded number
// of range requests in flight. Never collect the full WAV in memory.
export function readMasterInRanges(url: string, size: number, onProgress: (bytes: number) => void = () => {}, chunkBytes = 8 * 1024 * 1024, concurrency = 8) {
  if (!Number.isSafeInteger(size) || size < 44 || !Number.isInteger(chunkBytes) || chunkBytes < 1 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Invalid master range settings");
  const controller = new AbortController();
  const count = Math.ceil(size / chunkBytes);
  const pending = new Map<number, Promise<Uint8Array | Error>>();
  async function read(index: number) {
    const start = index * chunkBytes, end = Math.min(size - 1, start + chunkBytes - 1);
    let failure: Error = new Error("Master range unavailable");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal });
        if (response.status !== 206 || response.headers.get("content-range") !== `bytes ${start}-${end}/${size}`) { void response.body?.cancel(); throw new Error("Invalid master range response"); }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length !== end - start + 1) throw new Error("Incomplete master range");
        return bytes;
      } catch (error) { failure = error instanceof Error ? error : new Error("Master read failed"); if (controller.signal.aborted) break; }
    }
    return failure;
  }
  let next = 0;
  return new ReadableStream<Uint8Array>({
    start() { for (let i = 0; i < Math.min(concurrency, count); i++) pending.set(i, read(i)); },
    async pull(stream) {
      const bytes = await pending.get(next)!;
      pending.delete(next);
      if (bytes instanceof Error) { controller.abort(); stream.error(bytes); return; }
      stream.enqueue(bytes);
      next++;
      onProgress(Math.min(size, next * chunkBytes));
      if (next >= count) { stream.close(); return; }
      const upcoming = next + concurrency - 1;
      if (upcoming < count) pending.set(upcoming, read(upcoming));
    },
    cancel() { controller.abort(); pending.clear(); }
  }, { highWaterMark: 0 });
}
