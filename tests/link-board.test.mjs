import assert from "node:assert/strict";
import test from "node:test";
import { deskPreviewSources, toDeskBoard } from "../lib/link-board.ts";

test("YouTube desk links use video thumbnails when no CMS image exists", () => {
  const board = toDeskBoard({
    title: "Lowkal",
    links: [{ title: "Garden City", url: "https://youtu.be/NZETtyc9MFo" }]
  });

  assert.equal(board.links[0].youtubeId, "NZETtyc9MFo");
  assert.deepEqual(deskPreviewSources(board.links[0]), [
    "https://i.ytimg.com/vi/NZETtyc9MFo/maxresdefault.jpg",
    "https://i.ytimg.com/vi/NZETtyc9MFo/sddefault.jpg",
    "https://i.ytimg.com/vi/NZETtyc9MFo/hqdefault.jpg"
  ]);
});

test("a CMS preview image stays in front of the YouTube thumbnail", () => {
  const board = toDeskBoard({
    links: [{
      title: "Garden City",
      url: "https://www.youtube.com/watch?v=NZETtyc9MFo",
      imageUrl: "https://cdn.sanity.io/preview.jpg"
    }]
  });

  assert.equal(deskPreviewSources(board.links[0])[0], "https://cdn.sanity.io/preview.jpg");
  assert.ok(deskPreviewSources(board.links[0]).includes("https://i.ytimg.com/vi/NZETtyc9MFo/hqdefault.jpg"));
});
