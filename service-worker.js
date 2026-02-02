// ============================================
// SERVICE WORKER - Real D.O.R. Brescia PWA
// ============================================
// Versione: 2.1.0 (con Lazy Loading)
// Data: 2 Febbraio 2026
// 
// NOVITÀ v2.1.0:
// - Rimosso jsPDF dalla cache (ora lazy loaded)
// - Aggiunto Chart.js lazy loaded (non cachato inizialmente)
// - Strategia Cache First per massima velocità
// - Fonts Google aggiunti
// ============================================

const CACHE_VERSION = 'real-dor-v2.1.0';
const CACHE_NAME = CACHE_VERSION;

// Librerie da cacheare (SOLO quelle NON lazy-loaded)
const urlsToCache = [
  // App principale
  '/',
  '/index.html',
  '/manifest.json',
  
  // CSS & Fonts
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  
  // JavaScript Libraries (SEMPRE necessarie)
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  
  // ⚠️ RIMOSSI (ora lazy loaded):
  // - Chart.js → Caricato solo su Dashboard
  // - jsPDF → Caricato solo quando genera PDF
  // - jsPDF-autotable → Caricato solo quando genera PDF
];

// ============================================
// INSTALLAZIONE SERVICE WORKER
// ============================================
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker v2.1.0: Installazione...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cache aperta:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker v2.1.0: Installato con successo!');
        // Forza attivazione immediata
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Errore installazione:', error);
      })
  );
});

// ============================================
// ATTIVAZIONE SERVICE WORKER
// ============================================
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker v2.1.0: Attivazione...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Elimina cache vecchie (v2, v1, etc.)
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Service Worker: Elimino cache vecchia:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker v2.1.0: Attivato!');
        // Prendi controllo di tutte le pagine immediatamente
        return self.clients.claim();
      })
  );
});

// ============================================
// GESTIONE RICHIESTE (FETCH)
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora richieste non-HTTP (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // ⚠️ IMPORTANTE: Ignora Firebase (sempre fresh, mai cachato!)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('firestore') || 
      url.hostname.includes('firebasestorage')) {
    return event.respondWith(fetch(request));
  }
  
  // ============================================
  // STRATEGIA CACHE FIRST per Librerie
  // ============================================
  // Librerie CDN → Prova cache prima, poi network
  const isLibrary = url.hostname.includes('cdn') || 
                    url.hostname.includes('unpkg') || 
                    url.hostname.includes('cloudflare') ||
                    url.hostname.includes('jsdelivr') ||
                    url.hostname.includes('fonts.googleapis') ||
                    url.hostname.includes('fonts.gstatic');
  
  if (isLibrary) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // ✅ Trovato in cache → Usa cache (velocissimo!)
            console.log('⚡ Cache hit:', url.pathname);
            return cachedResponse;
          }
          
          // ❌ Non in cache → Scarica e salva per dopo
          console.log('📥 Cache miss, scarico:', url.pathname);
          return fetch(request)
            .then((response) => {
              // Verifica risposta valida
              if (!response || response.status !== 200 || response.type === 'error') {
                return response;
              }
              
              // Salva in cache per prossime volte
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                  console.log('💾 Salvato in cache:', url.pathname);
                });
              
              return response;
            })
            .catch((error) => {
              console.error('❌ Errore fetch libreria:', url.pathname, error);
              // Se network fallisce, prova ancora cache (doppio check)
              return caches.match(request).then(cached => {
                if (cached) return cached;
                // Nessuna cache disponibile
                return new Response('Offline - Libreria non disponibile', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({ 'Content-Type': 'text/plain' })
                });
              });
            });
        })
    );
    return;
  }
  
  // ============================================
  // STRATEGIA NETWORK FIRST per App
  // ============================================
  // File app (/, /index.html, /manifest.json) → Network first
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clona la risposta per salvare in cache
        const responseToCache = response.clone();
        
        // Aggiorna cache con versione fresca
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // Se rete fallisce, usa cache
        console.log('🌐 Network fail, uso cache:', url.pathname);
        return caches.match(request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Nessuna cache disponibile
            return new Response('Offline - Contenuto non disponibile', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});

// ============================================
// GESTIONE MESSAGGI (per forzare aggiornamento)
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 Service Worker: Skip waiting richiesto');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('🗑️ Service Worker: Pulizia cache richiesta');
    event.waitUntil(
      caches.keys().then(names => 
        Promise.all(names.map(name => caches.delete(name)))
      ).then(() => {
        console.log('✅ Service Worker: Cache pulita!');
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CACHE_CLEARED',
              message: 'Cache pulita con successo!'
            });
          });
        });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // Restituisci versione cache
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

console.log('🚀 Service Worker v2.1.0: Script caricato');
