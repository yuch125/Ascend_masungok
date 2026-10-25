/** Only static application files belong in this cache. Records stay in IndexedDB. */
export function createServiceWorker(files: string[], revision: string) {
  return `
const CACHE = ${JSON.stringify(`re-move-app-${revision}`)};
const STATIC = new Set(${JSON.stringify(files)});
const APP_MARKER = 'name="application-name" content="Re:Move"';
const BOOT_ASSET = ${JSON.stringify(files.find((path) => /^\/assets\/index-.*\.js$/.test(path)) ?? '')};
const isResource = path => STATIC.has(path) || path.startsWith('/models/') || path.startsWith('/mediapipe/');
const validStatic = response => response.ok && !response.redirected && response.type !== 'opaque' && response.type !== 'opaqueredirect';
async function appShell(response) {
  if (!validStatic(response) || !(response.headers.get('content-type') || '').includes('text/html')) return false;
  const html = await response.clone().text();
  return html.includes(APP_MARKER) && (!BOOT_ASSET || html.includes(BOOT_ASSET));
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const shell = await fetch('/', { cache: 'reload', credentials: 'same-origin' });
    if (!await appShell(shell)) throw new Error('Application shell is unavailable');
    await cache.put('/', shell);
    await Promise.all([...STATIC].map(async path => {
      const response = await fetch(path, { cache: 'reload', credentials: 'same-origin' });
      if (!validStatic(response) || (response.headers.get('content-type') || '').includes('text/html')) throw new Error('Static resource is unavailable');
      await cache.put(path, response);
    }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('re-move-app-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Auth redirects and server APIs always use the network, even offline.
  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (await appShell(response)) await (await caches.open(CACHE)).put('/', response.clone());
        return response;
      } catch {
        const cached = await (await caches.open(CACHE)).match('/');
        return cached || new Response('인터넷에 연결한 뒤 Re:Move를 한 번 열어 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
      }
    })());
  } else if (isResource(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE), cached = await cache.match(url.pathname);
      if (cached) return cached;
      const response = await fetch(request);
      if (validStatic(response) && !(response.headers.get('content-type') || '').includes('text/html')) await cache.put(url.pathname, response.clone());
      return response;
    })());
  }
});
`;
}
