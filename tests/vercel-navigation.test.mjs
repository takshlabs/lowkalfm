import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createStaticRoutes } from '../scripts/vercel-static-routes.mjs';

test('RSC requests receive exported payloads before HTML and retain compatibility headers', () => {
  const routes = createStaticRoutes(['index.rsc', 'listen.rsc', 'listen/archive.rsc', 'artists.rsc'], 'build-test');
  for (const [path, file] of [['/', '/index.rsc'], ['/listen', '/listen.rsc'], ['/listen/archive', '/listen/archive.rsc'], ['/artists/test', '/artists.rsc']]) {
    const route = routes.find(r => r.has?.some(h => h.key === 'rsc') && new RegExp(r.src).test(path));
    assert.ok(route, path);
    assert.equal(route.dest, file);
    assert.equal(route.headers['Content-Type'], 'text/x-component');
    assert.equal(route.headers['X-Vinext-RSC-Compatibility-Id'], 'build-test');
    assert.ok(route.headers.Vary.includes('RSC'));
  }
  assert.ok(routes.findIndex(r => r.handle === 'filesystem') > routes.findIndex(r => r.has));
});

test('ordinary page requests do not match the RSC-only rules', () => {
  const routes = createStaticRoutes(['index.rsc', 'listen.rsc'], 'build-test');
  assert.ok(routes.filter(r => r.dest?.endsWith('.rsc')).every(r => r.has?.some(h => h.type === 'header' && h.key === 'rsc' && h.value === '1')));
  assert.throws(() => createStaticRoutes(['index.rsc'], ''), /compatibility/i);
});

test('PWA files receive revalidation and root worker scope before the filesystem route', () => {
  const routes = createStaticRoutes(['index.rsc', 'sw.js', 'manifest.webmanifest'], 'build-test');
  const filesystemIndex = routes.findIndex(route => route.handle === 'filesystem');
  const workerIndex = routes.findIndex(route => route.src === '^/sw\\.js$');
  const manifestIndex = routes.findIndex(route => route.src === '^/manifest\\.webmanifest$');
  assert.ok(workerIndex >= 0 && workerIndex < filesystemIndex);
  assert.ok(manifestIndex >= 0 && manifestIndex < filesystemIndex);
  assert.equal(routes[workerIndex].headers['Service-Worker-Allowed'], '/');
  assert.match(routes[workerIndex].headers['Cache-Control'], /must-revalidate/);
  assert.match(routes[manifestIndex].headers['Cache-Control'], /max-age=300/);
});

test('static output applies baseline browser security headers before asset delivery', () => {
  const routes = createStaticRoutes(['index.rsc', 'index.html'], 'build-test');
  const filesystemIndex = routes.findIndex(route => route.handle === 'filesystem');
  const securityIndex = routes.findIndex(route => route.src === '^/.*$' && route.headers?.['X-Content-Type-Options'] === 'nosniff');
  assert.ok(securityIndex >= 0 && securityIndex < filesystemIndex);
  assert.equal(routes[securityIndex].continue, true);
  assert.equal(routes[securityIndex].headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(routes[securityIndex].headers['Permissions-Policy'], 'camera=(), geolocation=(), microphone=()');
  assert.equal(routes[securityIndex].headers['X-Frame-Options'], 'SAMEORIGIN');
});

test('project checks produce the exact Vercel static output before release', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['verify:vercel'], 'VERCEL=1 npm run build && node scripts/build-vercel-output.mjs');
  assert.match(packageJson.scripts.check, /npm run verify:vercel/);
});
