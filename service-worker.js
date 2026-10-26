const APP_VERSION = '1.0.9';
const CACHE_NAME = `knowme-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './questions.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch((error) => {
      console.error('Cache failed:', error);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isAppShell(url) {
  return APP_SHELL.some((path) => {
    const name = path.replace('./', '');
    if (!name) return url.pathname.endsWith('/');
    return url.pathname.endsWith('/' + name);
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/service-worker.js')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const refresh = fetch(event.request).then((response) => {
      if (response && response.ok && !response.redirected) {
        cache.put(event.request, response.clone());
      }
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }

    const fresh = await refresh;
    if (fresh) return fresh;

    if (event.request.mode === 'navigate' || isAppShell(url)) {
      const page = await cache.match('./index.html', { ignoreSearch: true });
      if (page) return page;
    }

    return new Response(
      '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>KnowMe</title></head><body style="font-family:sans-serif;padding:24px"><h1>KnowMe</h1><p>Open this app once while you have service. After that it will open without internet, and your notes stay on this phone.</p></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
});
