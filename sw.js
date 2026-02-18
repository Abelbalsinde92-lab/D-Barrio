const CACHE_NAME = 'dbarrio-v3';
const STATIC_ASSETS = [
  '/D-Barrio/',
  '/D-Barrio/index.html',
  '/D-Barrio/admin.html',
  '/D-Barrio/socio.html',
  '/D-Barrio/manifest.json',
  'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700;900&display=swap'
];

// INSTALAR - cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVAR - limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH - estrategia inteligente para Cuba
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase: siempre red primero (datos frescos)
  if (url.hostname.includes('firebase') || url.hostname.includes('firebaseio')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Google Fonts: cache primero
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
      )
    );
    return;
  }

  // HTML/JS/CSS: red primero, caché como respaldo (ideal para conexiones inestables)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});