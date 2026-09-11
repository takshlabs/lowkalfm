import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { createServiceWorker } from '../scripts/pwa-service-worker.mjs';

const root = new URL('../', import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), 'utf8'));
}

test('manifest defines an installable standalone Lowkal app', async () => {
  const manifest = await readJson('public/manifest.webmanifest');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0e0e0d');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose?.includes('maskable')));
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === '/listen'));
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === '/listen/archive'));
  for (const icon of manifest.icons) await access(new URL(`public${icon.src}`, root));
});

test('service worker separates documents from RSC and bypasses streamed media', () => {
  const source = createServiceWorker({
    version: 'test-build',
    precache: ['/index.html', '/index.rsc', '/offline.html', '/_next/static/app.js'],
  });
  assert.match(source, /const VERSION = "test-build"/);
  assert.match(source, /lowkal-doc-\$\{VERSION\}/);
  assert.match(source, /lowkal-rsc-\$\{VERSION\}/);
  assert.match(source, /request\.headers\.get\(['"]RSC['"]\)/i);
  assert.match(source, /request\.headers\.has\(['"]Range['"]\)/i);
  assert.match(source, /\/studio/);
  assert.match(source, /\/api\//);
  assert.match(source, /audio\//i);
  assert.match(source, /SKIP_WAITING/);
  assert.match(source, /clients\.claim/);
  assert.doesNotMatch(source, /skipWaiting\(\).*install/s);
});

test('service worker serves every precached shell asset and stores opened pages', async () => {
  const source = createServiceWorker({
    version: 'test-build',
    precache: ['/index.html', '/offline.html', '/soundroom/index.html', '/fonts/lowkal.woff2', '/_next/static/app.js'],
  });
  assert.match(source, /const PRECACHE_SET = new Set\(PRECACHE\)/);
  assert.ok(source.indexOf('PRECACHE_SET.has(url.pathname)') < source.indexOf("request.destination === 'image'"));
  assert.match(source, /cache\.put\(documentFallbackPath\(url\.pathname\), response\.clone\(\)\)/);
  assert.match(source, /cache\.put\(rscFallbackPath\(url\.pathname\), response\.clone\(\)\)/);
  assert.match(source, /if \(clean.endsWith\('\.html'\)\) return clean;/);
  assert.match(source, /PRECACHE_SET.has\(`\$\{clean\}\/index\.html`\)/);

  const buildSource = await readFile(new URL('scripts/build-pwa-assets.mjs', root), 'utf8');
  assert.match(buildSource, /path\.endsWith\('\.js'\)/);
  assert.match(buildSource, /referencedBuildAssets/);
  assert.match(buildSource, /routeShells[\s\S]*?readFile/);
  assert.doesNotMatch(buildSource, /files\.filter\(\(path\) =>\s*path\.startsWith\('_next\/static\/'\)/);
});

test('offline page is honest about streaming and offers recovery', async () => {
  const html = await readFile(new URL('public/offline.html', root), 'utf8');
  assert.match(html, /offline/i);
  assert.match(html, /connection/i);
  assert.match(html, /mixes need a connection/i);
  assert.match(html, /Try again/i);
});

test('PWA lifecycle stays headless and never forces updates during playback', async () => {
  const source = await readFile(new URL('components/PwaLifecycle.tsx', root), 'utf8');
  assert.doesNotMatch(source, /beforeinstallprompt/);
  assert.doesNotMatch(source, /preventDefault\(\)/);
  assert.match(source, /SKIP_WAITING/);
  assert.match(source, /isPlaying/);
  assert.match(source, /isLoading/);
  assert.match(source, /const playbackActive = isPlaying \|\| isLoading/);
  assert.match(source, /hasSharedPlaybackActivity/);
  assert.match(source, /return null/);
});

test('PWA lifecycle adds no overlay to the existing interface', async () => {
  const css = await readFile(new URL('app/reimagined.css', root), 'utf8');
  assert.doesNotMatch(css, /\.pwa-status/);
});

test('Soundroom does not depend on runtime third-party utility CSS', async () => {
  const html = await readFile(new URL('public/soundroom/index.html', root), 'utf8');
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /href="\.\/tailwind\.css"/);
  assert.match(html, /href="\.\/material-symbols\.css"/);
  await access(new URL('public/soundroom/tailwind.css', root));
  await access(new URL('public/soundroom/material-symbols.woff2', root));
});
