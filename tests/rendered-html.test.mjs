import assert from "node:assert/strict";
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

test("publishes the correct program architecture", async () => {
  const response = await render("/listen");
  const html = await response.text();

  assert.match(html, /Lowkal\.fm Vol\. 01/i);
  assert.match(html, /Lowkal 001 \| Redline/i);
  assert.match(html, /Weekly/i);
  assert.match(html, /Every two months/i);
  assert.doesNotMatch(html, /monthly transmission/i);
  assert.doesNotMatch(html, /Signal Room/i);
});
