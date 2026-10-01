import { writeFile } from 'node:fs/promises';

try { process.loadEnvFile('.env.local'); } catch { /* Hosted builds use environment variables. */ }
const project = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
const paths = ['/', '/listen', '/listen/archive', '/artists', '/read', '/go-out'];
if (project) {
  const url = new URL(`https://${project}.api.sanity.io/v2026-08-24/data/query/${encodeURIComponent(dataset)}`);
  url.searchParams.set('perspective', 'published');
  url.searchParams.set('query', '{"mixes":*[_type=="mix" && published==true && parked!=true && showInArchive!=false].slug.current,"artists":*[_type=="artist" && published==true].slug.current,"stories":*[_type=="editorialStory" && defined(publishedAt)].slug.current}');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sitemap CMS request failed: ${response.status}`);
  const { result } = await response.json();
  for (const [key, prefix] of [['mixes', '/listen/archive/'], ['artists', '/artists/'], ['stories', '/read/']]) {
    for (const slug of result[key] || []) if (slug) paths.push(prefix + encodeURIComponent(slug));
  }
}
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...new Set(paths)].map(path => `  <url><loc>https://lowkalfm.in${path.replaceAll('&', '&amp;')}</loc></url>`).join('\n') + '\n</urlset>\n';
await writeFile('dist/client/sitemap.xml', xml);
console.log(`Generated sitemap with ${new Set(paths).size} public paths.`);
