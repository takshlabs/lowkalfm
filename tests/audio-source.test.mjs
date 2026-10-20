import assert from "node:assert/strict";
import test from "node:test";
import { getMixStartOffset, getYouTubeVideoId, getYouTubeVideoUrl, resolveMixPlayback, resolveMixWaveform } from "../lib/audio-source.ts";

test("a missing CMS waveform URL uses the sidecar for the exact delivery asset", () => {
  const base = "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev/audio/mixes/mix-test/";
  for (const extension of ["wav", "flac"]) {
    const delivery = `${base}file-aabbcc-${extension}-Test.${extension}`;
    assert.equal(resolveMixWaveform(delivery), `${delivery}.spectrum-v2.json`);
    assert.notEqual(resolveMixWaveform(delivery.replace("aabbcc", "ddeeff")), resolveMixWaveform(delivery), "replacement masters must not reuse old waveform data");
    assert.equal(resolveMixWaveform(`${delivery}?download=1#position`), `${delivery}.spectrum-v2.json`);
  }
  assert.equal(resolveMixWaveform(`${base}Test.flac`, "https://audio.example/explicit.json"), "https://audio.example/explicit.json");
});

test("waveform recovery does not guess sidecars on unrelated audio hosts", () => {
  for (const url of [undefined, "", "not a URL", "https://cdn.sanity.io/files/project/production/asset.flac", "https://audio.example/master.wav", "https://youtube.com/watch?v=60O126HehGA", "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev/listen-counts", "http://lowkal-audio-sync.lowkal-audio-737a.workers.dev/audio/mixes/test/file.flac"]) {
    assert.equal(resolveMixWaveform(url), undefined);
  }
});

test("each mix resolves to one playback source with no master or source fallback", () => {
  assert.deepEqual(resolveMixPlayback({ deliveryUrl: "https://audio.example/direct.wav", youtubeUrl: "https://www.youtube.com/watch?v=fw2mtwgCeGo" }), { provider: "cloudflare", url: "https://audio.example/direct.wav" });
  assert.deepEqual(resolveMixPlayback({ youtubeUrl: "https://youtu.be/fw2mtwgCeGo" }), { provider: "youtube", videoId: "fw2mtwgCeGo" });
  assert.equal(resolveMixPlayback({ masterUrl: "https://sanity.example/master.wav" }), undefined);
  assert.equal(resolveMixPlayback({}), undefined);
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

test("display video links preserve valid YouTube URLs and reject other hosts", () => {
  const videoUrl = "https://www.youtube.com/watch?v=60O126HehGA&t=10";
  assert.equal(getYouTubeVideoUrl(videoUrl), videoUrl);
  assert.equal(getYouTubeVideoUrl("https://example.com/watch?v=60O126HehGA"), undefined);
  assert.equal(getYouTubeVideoUrl(undefined), undefined);
});
