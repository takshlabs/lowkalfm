import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServiceWorker } from './pwa-service-worker.mjs';

const root = 'dist/client';

async function collect(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? collect(join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return nested.flat();
}

const files = await collect(root);
const { compatibilityId } = JSON.parse(await readFile(join(root, 'lowkal-rsc-compatibility.json'), 'utf8'));
const required = [
  'manifest.webmanifest',
  'offline.html',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];
for (const path of required) {
  if (!files.includes(path)) throw new Error(`Required PWA asset is missing: ${path}`);
}

const routeShells = files.filter((path) =>
  (path.endsWith('.html') || path.endsWith('.rsc')) &&
  !path.startsWith('studio') &&
  !path.startsWith('artists/') &&
  !path.startsWith('read/'));
const localShellAssets = files.filter((path) =>
  path === 'manifest.webmanifest' ||
  path === 'offline.html' ||
  path.startsWith('icons/') ||
  path.startsWith('fonts/') ||
  path === 'lowkal-logo.jpg' ||
  path.startsWith('soundroom/'));
const shellSources = await Promise.all(routeShells.map((path) => readFile(join(root, path), 'utf8')));
const referencedBuildAssets = [...new Set(shellSources.flatMap((source) =>
  [...source.matchAll(/\/_next\/static\/[^"'\\\s?]+\.(?:css|js)/g)].map((match) => match[0].slice(1))))]
  .filter((path) => files.includes(path) && (path.endsWith('.css') || path.endsWith('.js')));
const precache = [...routeShells, ...localShellAssets, ...referencedBuildAssets].map((path) => `/${path}`);

await writeFile(join(root, 'sw.js'), createServiceWorker({ version: compatibilityId, precache }));
console.log(`Generated Lowkal service worker ${compatibilityId} with ${precache.length} shell assets.`);
