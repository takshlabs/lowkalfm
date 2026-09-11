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

test("queue advancement stops at the end unless repeat-all is active", () => {
  assert.equal(playback.nextQueueIndex(0, 3, "off"), 1);
  assert.equal(playback.nextQueueIndex(2, 3, "off"), null);
  assert.equal(playback.nextQueueIndex(2, 3, "all"), 0);
  assert.equal(playback.previousQueueIndex(0, 3, "off"), null);
  assert.equal(playback.previousQueueIndex(0, 3, "all"), 2);
});

test("repeat-one replays only on ended and previous restarts after three seconds", () => {
  assert.equal(playback.endedQueueIndex(1, 3, "one"), 1);
  assert.equal(playback.endedQueueIndex(2, 3, "off"), null);
  assert.equal(playback.shouldRestartPrevious(13.1, 10), true);
  assert.equal(playback.shouldRestartPrevious(12.9, 10), false);
});

test("shuffle order keeps the current record first and includes each slug once", () => {
  const order = playback.createShuffleOrder(["one", "two", "three", "four"], "three", () => 0);
  assert.equal(order[0], "three");
  assert.deepEqual(new Set(order), new Set(["one", "two", "three", "four"]));
  assert.equal(order.length, 4);
});

test("simultaneous playback claims choose one deterministic owner", () => {
  const first = { timestamp: 10, sequence: 1, tabId: "a" };
  const second = { timestamp: 10, sequence: 1, tabId: "b" };
  assert.equal(playback.comparePlaybackClaims(first, second), -1);
  assert.equal(playback.comparePlaybackClaims(second, first), 1);
  assert.equal(playback.comparePlaybackClaims(first, first), 0);
  assert.equal(playback.comparePlaybackClaims({ ...first, sequence: 2 }, second), 1);
});
