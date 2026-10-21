type AudioMaster = {
  asset?: { _ref?: string };
  _upload?: {
    progress?: number;
    createdAt?: string;
    updatedAt?: string;
    updated?: string;
  };
};

export const AUDIO_UPLOAD_STALE_MS = 2 * 60 * 1000;

export function audioUploadStatus(value: AudioMaster | undefined, now: number) {
  const upload = value?._upload;
  if (!upload) return undefined;
  // Sanity's file uploader writes `updated`; its image uploader writes `updatedAt`.
  const timestamps = [upload.updated, upload.updatedAt, upload.createdAt]
    .map((date) => Date.parse(date || ""))
    .filter(Number.isFinite);
  const lastProgress = timestamps.length ? Math.max(...timestamps) : now;
  const progress = typeof upload.progress === "number" && Number.isFinite(upload.progress) ? Math.max(0, Math.min(100, upload.progress)) : 0;
  return { progress, stalled: now - lastProgress >= AUDIO_UPLOAD_STALE_MS };
}

export function validateAudioMaster(value: AudioMaster | undefined) {
  if (value?._upload) return "Wait for the audio upload to finish. If it stopped, cancel it and select the file again.";
  if (value && !value.asset?._ref) return "Select an audio master and wait for the upload to finish.";
  return true;
}
