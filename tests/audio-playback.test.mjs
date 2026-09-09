import assert from "node:assert/strict";
import test from "node:test";
const playback = await import("../lib/audio-playback.ts").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});

test("seek values stay finite and preserve zero before metadata", () => {
  assert.equal(typeof playback.boundPlaybackTime, "function");
  assert.equal(playback.boundPlaybackTime(0, 100), 0);
  assert.equal(playback.boundPlaybackTime(90, NaN), 90);
  assert.equal(playback.boundPlaybackTime(90, 50), 50);
  assert.equal(playback.boundPlaybackTime(-5, Infinity), 0);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(playback.boundPlaybackTime(value, 100), null);
});

test("only the newest play request can report failure after pause, retry or track change", () => {
  assert.equal(typeof playback.createPlaybackRequests, "function");
  const requests = playback.createPlaybackRequests();
  const first = requests.begin();
  requests.cancel();
  assert.equal(requests.isCurrent(first), false);
  const second = requests.begin();
  const third = requests.begin();
  assert.equal(requests.isCurrent(second), false);
  assert.equal(requests.isCurrent(third), true);
});
