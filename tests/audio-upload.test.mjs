import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_UPLOAD_STALE_MS, audioUploadStatus, validateAudioMaster } from "../lib/audio-upload.ts";

const started = Date.parse("2026-10-21T11:21:13.452Z");

test("file upload heartbeat takes precedence over the unchanged creation timestamp", () => {
  const value = { _upload: { progress: 35, createdAt: new Date(started).toISOString(), updatedAt: new Date(started).toISOString(), updated: new Date(started + 90_000).toISOString() } };
  assert.deepEqual(audioUploadStatus(value, started + 180_000), { progress: 35, stalled: false });
  assert.deepEqual(audioUploadStatus(value, started + 90_000 + AUDIO_UPLOAD_STALE_MS), { progress: 35, stalled: true });
});

test("new upload timestamps and invalid legacy timestamps do not cause a false warning", () => {
  assert.equal(audioUploadStatus({ _upload: { updated: "invalid", updatedAt: new Date(started).toISOString() } }, started).stalled, false);
  assert.equal(audioUploadStatus({ _upload: {} }, started).stalled, false);
  assert.equal(audioUploadStatus(undefined, started), undefined);
  assert.equal(audioUploadStatus({ asset: { _ref: "file-master-wav" } }, started), undefined);
});

test("incomplete masters block publication, including replacements of an existing master", () => {
  assert.equal(typeof validateAudioMaster({ _upload: { progress: 100 } }), "string");
  assert.equal(typeof validateAudioMaster({ asset: { _ref: "file-old-wav" }, _upload: { progress: 35 } }), "string");
  assert.equal(typeof validateAudioMaster({}), "string");
  assert.equal(validateAudioMaster({ asset: { _ref: "file-master-wav" } }), true);
  assert.equal(validateAudioMaster(undefined), true);
});
