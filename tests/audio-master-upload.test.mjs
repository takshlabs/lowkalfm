import assert from "node:assert/strict";
import test from "node:test";
import { uploadAudioMaster, audioUploadError } from "../lib/audio-master-upload.ts";

const file = new File(["RIFF test audio"], "master.wav", { type: "audio/wav" });
const response = { type: "response", body: { document: { _id: "file-new-wav" } } };

function fixture(behavior, overrides = {}) {
  const attempts = [];
  const subscribers = [];
  let cancelled = 0;
  const controller = new AbortController();
  const client = { observable: { assets: { upload(type, body, options) {
    assert.equal(type, "file");
    assert.equal(body, file, "retries retain the original lossless File");
    assert.equal(options.filename, file.name);
    return { subscribe(observer) {
      subscribers.push(observer);
      behavior(observer, subscribers.length);
      return { unsubscribe() { cancelled += 1; } };
    } };
  } } } };
  const options = { signal: controller.signal, onAttempt: n => attempts.push(n), onProgress() {}, idleMs: 15, saveMs: 60, retryMs: 1, ...overrides };
  return { run: () => uploadAudioMaster(client, file, options), attempts, subscribers, controller, cancelled: () => cancelled };
}

test("a stalled request is cancelled and retried; a late old response cannot win", async () => {
  const f = fixture((observer, attempt) => {
    if (attempt === 2) queueMicrotask(() => {
      f.subscribers[0].next({ type: "response", body: { document: { _id: "file-stale-wav" } } });
      observer.next(response);
      observer.complete();
    });
  });
  assert.equal(await f.run(), "file-new-wav");
  assert.deepEqual(f.attempts, [1, 2]);
  assert.equal(f.cancelled(), 2);
});

test("network failures stop after three attempts and preserve the failure message", async () => {
  const f = fixture(observer => queueMicrotask(() => observer.error(new Error("XHR upload network error"))));
  await assert.rejects(f.run(), /network error/);
  assert.deepEqual(f.attempts, [1, 2, 3]);
});

test("permission and file-size errors do not retry", async () => {
  for (const statusCode of [401, 403, 413]) {
    const failure = Object.assign(new Error("refused"), { statusCode });
    const f = fixture(observer => queueMicrotask(() => observer.error(failure)));
    await assert.rejects(f.run(), /refused/);
    assert.deepEqual(f.attempts, [1]);
    assert.match(audioUploadError(failure), statusCode === 413 ? /file size/ : /permission/);
  }
});

test("cancel aborts the active request and prevents retry and late success", async () => {
  const f = fixture(() => {});
  const result = f.run();
  f.controller.abort();
  f.subscribers[0].next(response);
  await assert.rejects(result, { name: "AbortError" });
  assert.deepEqual(f.attempts, [1]);
  assert.equal(f.cancelled(), 1);
});

test("byte progress keeps slow uploads alive even when the percentage does not change", async () => {
  let interval;
  const f = fixture(observer => {
    let loaded = 0;
    interval = setInterval(() => {
      loaded += 1;
      observer.next({ type: "progress", percent: 38, loaded });
      if (loaded === 8) { clearInterval(interval); observer.next(response); }
    }, 5);
  });
  try {
    assert.equal(await f.run(), "file-new-wav");
    assert.deepEqual(f.attempts, [1]);
  } finally { clearInterval(interval); }
});

test("100 percent waits for the saved asset response before success", async () => {
  const f = fixture(observer => {
    observer.next({ type: "progress", loaded: file.size, percent: 100 });
    setTimeout(() => observer.next(response), 30);
  });
  assert.equal(await f.run(), "file-new-wav");
  assert.deepEqual(f.attempts, [1]);
});

test("server failures retry but an empty completion is never a saved asset", async () => {
  const f = fixture((observer, n) => queueMicrotask(() => {
    if (n === 1) observer.error(Object.assign(new Error("busy"), { statusCode: 503 }));
    else observer.complete();
  }));
  await assert.rejects(f.run(), /before Sanity confirmed/);
  assert.deepEqual(f.attempts, [1, 2, 3]);
});

test("cancel during retry delay prevents the next request", async () => {
  const f = fixture(observer => queueMicrotask(() => {
    observer.error(new Error("network error"));
    setTimeout(() => f.controller.abort(), 2);
  }), { retryMs: 30 });
  await assert.rejects(f.run(), { name: "AbortError" });
  assert.deepEqual(f.attempts, [1]);
});

test("a synchronous response or request failure releases the transport and timers", async () => {
  const f = fixture(observer => observer.next(response));
  assert.equal(await f.run(), "file-new-wav");
  assert.equal(f.cancelled(), 1);
  const broken = fixture(() => { throw Object.assign(new Error("invalid request"), { statusCode: 400 }); });
  await assert.rejects(broken.run(), /invalid request/);
  assert.deepEqual(broken.attempts, [1]);
});

test("the installed Sanity client sends the file with progress and returns the saved asset ID", async () => {
  const { createClient } = await import("@sanity/client");
  const original = globalThis.XMLHttpRequest;
  const requests = [];
  class UploadRequest {
    upload = {};
    status = 200;
    responseText = JSON.stringify(response.body);
    headers = {};
    open(method, url) { this.method = method; this.url = url; requests.push(this); }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(body) {
      this.body = body;
      queueMicrotask(() => {
        this.upload.onprogress({ lengthComputable: true, loaded: body.size, total: body.size });
        this.onload();
      });
    }
    abort() { this.aborted = true; }
  }
  globalThis.XMLHttpRequest = UploadRequest;
  try {
    const client = createClient({ projectId: "lowkaltest", dataset: "production", apiVersion: "2026-01-01", useCdn: false, withCredentials: true });
    const progress = [];
    const id = await uploadAudioMaster(client, file, { signal: new AbortController().signal, onAttempt() {}, onProgress: value => progress.push(value) });
    assert.equal(id, "file-new-wav");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body, file);
    assert.equal(requests[0].withCredentials, true);
    assert.match(requests[0].url, /assets\/files\/production\?filename=master.wav/);
    assert.equal(requests[0].headers["Content-Type"], "audio/wav");
    assert.deepEqual(progress, [100]);
    assert.equal(requests[0].aborted, true, "the settled request is released");
  } finally {
    if (original) globalThis.XMLHttpRequest = original;
    else delete globalThis.XMLHttpRequest;
  }
});
