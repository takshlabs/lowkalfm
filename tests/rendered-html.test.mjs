import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

const routes = [
  ["/", /The city has a/i],
  ["/listen", /Lowkal Soundroom/i],
  ["/read", /Stories behind/i],
  ["/go-out", /Selected by Lowkal/i],
];

for (const [pathname, expectedText] of routes) {
  test(`server-renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, expectedText);
    assert.match(html, /LOWKAL\.FM/i);
    assert.match(html, /Soundroom/i);
  });
}

test("keeps the original Soundroom as a standalone archive asset", async () => {
  const soundroom = await readFile(new URL("../public/soundroom/index.html", import.meta.url), "utf8");
  const mixes = JSON.parse(await readFile(new URL("../public/soundroom/mixes.json", import.meta.url), "utf8"));

  assert.match(soundroom, /Enter Archive/i);
  assert.match(soundroom, /id="screen-home"/i);
  assert.match(soundroom, /id="screen-archive"/i);
  assert.equal(mixes[0].title, "Redline 006");
  assert.equal(mixes[0].dj, "Takezo");
});
