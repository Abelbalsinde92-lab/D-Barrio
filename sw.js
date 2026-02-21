/* ========= D'BARRIO SERVICE WORKER (CUBA SAFE) ========= */
const CACHE_VERSION = 4;
const APP_CACHE = `dbarrio-app-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `dbarrio-rt-v${CACHE_VERSION}`;
const FONT_CACHE = `dbarrio-fonts-v${CACHE_VERSION}`;

// Ajusta esta BASE si tu repo cambia.
// En GitHub Pages normalmente es "/D-Barrio/"
const BASE = '/D-Barrio/';

// Cachea SOLO assets locales (nada externo aquí)
const APP_SHELL = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}admin.html`,
  `${BASE}socio.html`,
  `${BASE}manifest.json`,
  `${BASE}sw.js`
  // Si tienes iconos, agrégalos aquí:
  // `${BASE}icon-192.png`,
  // `${BASE}icon-512.png`,
  // `${BASE}offline.html`,
];

// INSTALAR
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ACTIVAR
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (![APP_CACHE, RUNTIME_CACHE, FONT_CACHE].includes(k)) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

// Helpers
function isSupabase(url) {
  return url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in');
}

function isHTMLRequest(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

function stripSearch(request) {
  // Para evitar cache duplicado por ?v=...
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), request);
}

// FETCH
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Supabase: SIEMPRE red (no cache) => datos frescos
  if (isSupabase(url)) {
    event.respondWith(
      fetch(req).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // 2) Google Fonts: stale-while-revalidate en cache aparte
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((res) => {
        // OJO: algunas respuestas serán opaque; igual se pueden guardar
        cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }

  // 3) Navegación (index/admin/socio): network-first con fallback a index
  if (isHTMLRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // cachear la versión sin query
        const cache = await caches.open(APP_CACHE);
        cache.put(stripSearch(req), fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        // fallback: intenta la página pedida; si no, index
        const cache = await caches.open(APP_CACHE);
        const cachedPage = await cache.match(stripSearch(req));
        return cachedPage || cache.match(`${BASE}index.html`);
      }
    })());
    return;
  }

  // 4) Assets locales (JS/CSS/img): cache-first con actualización en background
  event.respondWith((async () => {
    const cacheReq = stripSearch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(cacheReq);

    if (cached) {
      // revalidación en background
      fetch(req).then((res) => {
        if (res && res.ok) cache.put(cacheReq, res.clone()).catch(() => {});
      }).catch(() => {});
      return cached;
    }

    // si no hay cache, intenta red y guarda
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(cacheReq, res.clone()).catch(() => {});
      return res;
    } catch (e) {
      // último recurso
      return cached || new Response('', { status: 504 });
    }
  })());
});