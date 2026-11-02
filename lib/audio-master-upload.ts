import type { SanityClient } from "@sanity/client";

export const AUDIO_UPLOAD_ATTEMPTS = 3;
export const AUDIO_UPLOAD_BASE = "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev";
export type DirectAudioMaster = { r2Key: string; r2Id: string; filename: string; size: number; url: string; duration?: number };
type Checkpoint = { fingerprint: string; token: string; partBytes: number; parts: { partNumber: number; etag: string }[] };
type Options = {
  signal: AbortSignal;
  mixId: string;
  onAttempt: (attempt: number) => void;
  onProgress: (percent: number) => void;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  retryMs?: number;
};
export function audioUploadError(error: unknown) {
  return error instanceof Error ? error.message : "The audio upload failed.";
}
function storageKey(mixId: string) { return `lowkal-audio-parts-v1:${mixId}`; }
function browserStorage() {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}
export async function cancelAudioUpload(mixId: string) {
  const storage = browserStorage();
  try {
    const checkpoint = JSON.parse(storage?.getItem(storageKey(mixId)) || "null") as Checkpoint | null;
    storage?.removeItem(storageKey(mixId));
    if (checkpoint) await fetch(`${AUDIO_UPLOAD_BASE}/uploads/abort`, { method: "DELETE", headers: { Authorization: `Bearer ${checkpoint.token}` }, signal: AbortSignal.timeout(15_000) });
  } catch { /* R2 also expires unfinished multipart uploads. */ }
}

export async function uploadAudioMaster(client: SanityClient, file: File, options: Options): Promise<DirectAudioMaster> {
  const storage = options.storage ?? browserStorage();
  const key = storageKey(options.mixId);
  const digest = await crypto.subtle.digest("SHA-256", await file.slice(0, 65536).arrayBuffer());
  const fingerprint = JSON.stringify([file.name, file.size, file.lastModified, Array.from(new Uint8Array(digest)).join(",")]);
  let saved: Checkpoint | undefined;
  try {
    const value = JSON.parse(storage?.getItem(key) || "null") as Checkpoint | null;
    if (value?.fingerprint === fingerprint && value.token && value.partBytes === 8 * 1024 * 1024 && Array.isArray(value.parts)) saved = value;
  } catch { /* Storage can be blocked. The current upload still works. */ }
  const persist = () => { try { storage?.setItem(key, JSON.stringify(saved)); } catch { /* Keep the in-memory checkpoint. */ } };
  const request = async <T>(path: string, init: RequestInit, token: string): Promise<T> => {
    for (let attempt = 1; ; attempt += 1) {
      options.signal.throwIfAborted();
      options.onAttempt(attempt);
      try {
        const response = await fetch(`${AUDIO_UPLOAD_BASE}/uploads/${path}`, {
          ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers },
          signal: AbortSignal.any([options.signal, AbortSignal.timeout(120_000)])
        });
        const data = await response.json() as T & { error?: string };
        if (response.status === 401) { try { storage?.removeItem(key); } catch { /* storage unavailable */ } }
        if (!response.ok) throw Object.assign(new Error(data.error || `Audio upload failed (${response.status}).`), { statusCode: response.status });
        return data;
      } catch (error) {
        options.signal.throwIfAborted();
        const code = (error as { statusCode?: number })?.statusCode;
        if ((code && code < 500 && code !== 408 && code !== 429) || attempt >= AUDIO_UPLOAD_ATTEMPTS) throw error;
        await new Promise<void>((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(options.signal.reason); };
          const timer = setTimeout(() => { options.signal.removeEventListener("abort", cancel); resolve(); }, (options.retryMs ?? 1500) * attempt);
          options.signal.addEventListener("abort", cancel, { once: true });
        });
      }
    }
  };
  if (!saved) {
    const token = client.config().token;
    if (!token) throw new Error("Your Studio session is unavailable. Sign in again before uploading audio.");
    const session = await request<{ token: string; partBytes: number }>("start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, size: file.size, mixId: options.mixId }) }, token);
    saved = { fingerprint, ...session, parts: [] };
    persist();
  }
  for (let offset = saved.parts.length * saved.partBytes; offset < file.size; offset += saved.partBytes) {
    options.onProgress(Math.floor(offset / file.size * 100));
    const partNumber = saved.parts.length + 1;
    const part = await request<{ partNumber: number; etag: string }>(`part?part=${partNumber}`, { method: "PUT", body: file.slice(offset, offset + saved.partBytes) }, saved.token);
    saved.parts.push(part);
    persist();
    options.onProgress(Math.min(100, Math.floor((offset + saved.partBytes) / file.size * 100)));
  }
  const result = await request<DirectAudioMaster>("complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parts: saved.parts }) }, saved.token);
  // Retain the checkpoint until the CMS patch is applied. A refresh or a lost
  // complete response can repeat completion without sending the audio again.
  return result;
}
