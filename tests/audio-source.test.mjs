import assert from "node:assert/strict";
import test from "node:test";
import { getMixStartOffset, getYouTubeVideoId, resolveMixPlayback } from "../lib/audio-source.ts";

test("mix playback prefers Cloudflare, then Sanity, then YouTube", () => {
  assert.deepEqual(resolveMixPlayback({ deliveryUrl: "https://audio.example/direct.wav", masterUrl: "https://sanity.example/master.wav", externalUrl: "https://www.youtube.com/watch?v=fw2mtwgCeGo" }), { audioUrl: "https://audio.example/direct.wav", youtubeId: "fw2mtwgCeGo" });
  assert.deepEqual(resolveMixPlayback({ masterUrl: "https://sanity.example/master.wav", externalUrl: "https://youtu.be/fw2mtwgCeGo" }), { audioUrl: "https://sanity.example/master.wav", youtubeId: "fw2mtwgCeGo" });
  assert.deepEqual(resolveMixPlayback({ externalUrl: "https://youtube.com/embed/fw2mtwgCeGo" }), { audioUrl: undefined, youtubeId: "fw2mtwgCeGo" });
});

test("start offsets preserve valid seconds and make invalid values safe", () => {
  assert.equal(getMixStartOffset(undefined), 0);
  assert.equal(getMixStartOffset(-4), 0);
  assert.equal(getMixStartOffset(Number.NaN), 0);
  assert.equal(getMixStartOffset(3.5), 3.5);
});

test("YouTube parsing accepts supported formats and rejects invalid IDs and hosts", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=60O126HehGA&list=abc",
    "https://youtu.be/60O126HehGA?t=4",
    "https://youtube.com/embed/60O126HehGA",
    "https://youtube.com/shorts/60O126HehGA",
    "https://youtube.com/live/60O126HehGA",
  ]) assert.equal(getYouTubeVideoId(url), "60O126HehGA");

  for (const url of [
    undefined,
    "",
    "not a url",
    "https://example.com/watch?v=60O126HehGA",
    "https://youtube.com/watch?v=short",
    "https://youtube.com/watch?v=60O126HehGA-extra",
  ]) assert.equal(getYouTubeVideoId(url), undefined);
});
