import assert from 'node:assert/strict';
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
