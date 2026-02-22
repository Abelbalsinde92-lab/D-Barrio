const VERSION = 'dbarrio-v12';               // 👈 súbelo cada vez que cambies fuerte
const BASE = '/D-Barrio/';                   // 👈 carpeta del repo en GitHub Pages

const CORE = [
  BASE,
  BASE + 'index.html',
  BASE + 'admin.html',
  BASE + 'socio.html',
  BASE + 'manifest.json',
  BASE + 'sw.js'
];

// ---------------- INSTALL ----------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// ---------------- ACTIVATE ----------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Helpers
function isHTML(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCorePath(url) {
  return isSameOrigin(url) && (
    url.pathname === BASE ||
    url.pathname === BASE + 'index.html' ||
    url.pathname === BASE + 'admin.html' ||
    url.pathname === BASE + 'socio.html' ||
    url.pathname === BASE + 'manifest.json' ||
    url.pathname === BASE + 'sw.js'
  );
}

// ---------------- FETCH ----------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 0) Nunca cachear Supabase / WA / CDNs (evita bloqueos)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('wa.me') ||
    url.hostname.includes('cdn.jsdelivr') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // 1) HTML y páginas core: NETWORK FIRST (para que nunca “se quede viejo”)
  if (isHTML(req) || isCorePath(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match(BASE + 'index.html'))
        )
    );
    return;
  }

  // 2) Google Fonts: CACHE FIRST
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone));
          return res;
        });
      })
    );
    return;
  }

  // 3) Estáticos (css/js/img) same-origin: STALE-WHILE-REVALIDATE (rápido + se actualiza)
  if (isSameOrigin(url) && ['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            const clone = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, clone));
            return res;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4) Default: NETWORK FIRST con fallback caché
  event.respondWith(
    fetch(req)
      .then((res) => {
        const clone = res.clone();
        caches.open(VERSION).then((cache) => cache.put(req, clone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});