import type { SanityClient } from "@sanity/client";

export const AUDIO_UPLOAD_ATTEMPTS = 3;

export function audioUploadError(error: unknown) {
  const code = (error as { statusCode?: number })?.statusCode;
  if (code === 401 || code === 403) return "Sanity refused the upload. Check your Studio sign-in and file upload permission.";
  if (code === 413) return "Sanity rejected the file size. Select a smaller lossless master.";
  return error instanceof Error ? error.message : "The audio upload failed.";
}

function canRetry(error: unknown) {
  const code = (error as { statusCode?: number })?.statusCode;
  return !code || code === 408 || code === 429 || code >= 500;
}

function abortError() {
  return new DOMException("Upload cancelled.", "AbortError");
}

type Options = {
  signal: AbortSignal;
  onAttempt: (attempt: number) => void;
  onProgress: (percent: number) => void;
  idleMs?: number;
  saveMs?: number;
  retryMs?: number;
};

// Keep the original File for retries. Sanity's asset API restarts the transfer;
// it cannot resume a partially uploaded file.
export async function uploadAudioMaster(client: SanityClient, file: File, options: Options) {
  for (let attempt = 1; attempt <= AUDIO_UPLOAD_ATTEMPTS; attempt += 1) {
    options.signal.throwIfAborted();
    options.onAttempt(attempt);
    try {
      return await uploadAttempt(client, file, options);
    } catch (error) {
      options.signal.throwIfAborted();
      if (!canRetry(error) || attempt === AUDIO_UPLOAD_ATTEMPTS) throw error;
      await new Promise<void>((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); reject(abortError()); };
        const timer = setTimeout(() => {
          options.signal.removeEventListener("abort", cancel);
          resolve();
        }, (options.retryMs ?? 2000) * attempt);
        options.signal.addEventListener("abort", cancel, { once: true });
      });
    }
  }
  throw new Error("The audio upload failed.");
}

function uploadAttempt(client: SanityClient, file: File, options: Options): Promise<string> {
  return new Promise((resolve, reject) => {
    const transport: { subscription?: { unsubscribe: () => void } } = {};
    let timer: ReturnType<typeof setTimeout>;
    let settled = false;
    let loaded = 0;
    const finish = (error?: unknown, assetId?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal.removeEventListener("abort", cancel);
      transport.subscription?.unsubscribe();
      if (assetId) resolve(assetId);
      else reject(error);
    };
    const cancel = () => finish(abortError());
    const armTimer = (saving = false) => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error(saving
        ? "Sanity did not confirm that the file was saved. Check your connection and retry."
        : "No audio data was sent for 2 minutes. Check your connection and retry.")),
      saving ? (options.saveMs ?? 300_000) : (options.idleMs ?? 120_000));
    };
    options.signal.addEventListener("abort", cancel, { once: true });
    if (options.signal.aborted) { cancel(); return; }
    armTimer();
    try {
      transport.subscription = client.observable.assets.upload("file", file, { filename: file.name, contentType: file.type || "application/octet-stream", timeout: 0 }).subscribe({
        next(event) {
          if (settled) return;
          if (event.type === "response") {
            const id = event.body.document?._id;
            finish(id ? undefined : new Error("Sanity did not return a saved audio file."), id);
          } else if (event.type === "progress") {
            // A large file can send many bytes without changing its rounded percentage.
            if ((event.loaded ?? 0) > loaded) {
              loaded = event.loaded ?? 0;
              armTimer(event.percent >= 100);
            }
            options.onProgress(Math.min(100, Math.max(0, event.percent)));
          }
        },
        error: (error: unknown) => finish(error),
        complete: () => finish(new Error("The upload ended before Sanity confirmed the file."))
      });
      if (settled) transport.subscription.unsubscribe();
    } catch (error) {
      finish(error);
    }
  });
}
