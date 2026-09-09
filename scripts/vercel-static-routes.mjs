const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createStaticRoutes(files, compatibilityId) {
  if (!compatibilityId) throw new Error('Missing RSC compatibility ID');
  const headers = {
    'Content-Type': 'text/x-component',
    'X-Vinext-RSC-Compatibility-Id': compatibilityId,
    'Cache-Control': 'public, max-age=0, must-revalidate',
    Vary: 'RSC, Accept',
  };
  const routes = files.filter(file => file.endsWith('.rsc')).map(file => ({
    src: file === 'index.rsc' ? '^/$' : `^/${escape(file.slice(0, -4))}/?$`,
    has: [{ type: 'header', key: 'rsc', value: '1' }],
    dest: `/${file}`,
    headers,
  }));
  if (files.includes('artists.rsc')) routes.push({
    src: '^/artists/[^/]+/?$', has: [{ type: 'header', key: 'rsc', value: '1' }], dest: '/artists.rsc', headers,
  });
  routes.push({ src: '^/.*\\.rsc$', headers, continue: true });
  routes.push({ handle: 'filesystem' });
  // Static HTML remains directly addressable on refresh and shared links.
  for (const file of files.filter(file => file.endsWith('.rsc') && file !== 'index.rsc')) {
    routes.push({ src: `^/${escape(file.slice(0, -4))}/?$`, dest: `/${file.slice(0, -4)}.html` });
  }
  routes.push({ src: '^/artists/[^/]+/?$', dest: '/artists.html' });
  return routes;
}
