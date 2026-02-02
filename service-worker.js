// Service Worker per Real D.O.R. PWA
const CACHE_NAME = 'real-dor-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// Installazione
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aperta');
        return cache.addAll(urlsToCache);
      })
  );
});

// Attivazione
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch - strategia Network First, poi Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona la risposta
        const responseToCache = response.clone();
        
        // Aggiorna la cache
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // Se la rete fallisce, prova dalla cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Se non è in cache, restituisci una risposta offline
            return new Response('Offline - contenuto non disponibile', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});
