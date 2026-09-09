import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createStaticRoutes } from './vercel-static-routes.mjs';

const source = 'dist/client';
const output = '.vercel/output';
const { compatibilityId } = JSON.parse(await readFile(join(source, 'lowkal-rsc-compatibility.json'), 'utf8'));
async function collect(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? collect(join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return files.flat();
}
const files = await collect(source);
if (!files.includes('listen.rsc') || !files.includes('listen/archive.rsc')) throw new Error('Static Soundroom payloads are missing');
await mkdir(output, { recursive: true });
await cp(source, join(output, 'static'), { recursive: true });
await writeFile(join(output, 'config.json'), JSON.stringify({ version: 3, routes: createStaticRoutes(files, compatibilityId) }, null, 2));
console.log('Vercel static output includes RSC routing and build compatibility headers.');
