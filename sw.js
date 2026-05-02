// ── Emondt Materiaalapp – Service Worker ──────────────────────
// Versie: bump dit getal na elke app-update om cache te vernieuwen
const CACHE_NAAM = 'emondt-materiaalapp-v3.0.0';

// Bestanden die offline beschikbaar moeten zijn
const TE_CACHEN = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  // Google Fonts (worden gecached bij eerste bezoek)
  'https://fonts.googleapis.com/css2?family=Questrial&display=swap',
];

// ── INSTALL: cache alle app-bestanden ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAAM).then(cache => {
      console.log('[SW] Bestanden in cache opslaan...');
      const lokaal = TE_CACHEN.filter(url => !url.startsWith('http'));
      const extern = TE_CACHEN.filter(url => url.startsWith('http'));
      return cache.addAll(lokaal).then(() =>
        Promise.all(
          extern.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(res => cache.put(url, res))
              .catch(() => {})
          )
        )
      );
    }).then(() => {
      console.log('[SW] Installatie voltooid');
      return self.skipWaiting(); // Nieuwe SW activeert direct, wacht niet op tab-sluiten
    })
  );
});

// ── ACTIVATE: verwijder oude caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(namen =>
      Promise.all(
        namen
          .filter(naam => naam !== CACHE_NAAM)
          .map(naam => {
            console.log('[SW] Oude cache verwijderd:', naam);
            return caches.delete(naam);
          })
      )
    ).then(() => {
      console.log('[SW] Activatie voltooid');
      return self.clients.claim(); // Claim alle open tabs direct
    })
  );
});

// ── FETCH: Network-first voor HTML, cache-first voor assets ───
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first voor index.html: altijd nieuwste versie ophalen
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.status === 200) {
            // Sla verse versie op in cache
            caches.open(CACHE_NAAM).then(cache => cache.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => {
          // Geen internet: gebruik gecachte versie als fallback
          console.log('[SW] Offline – gecachte HTML gebruikt');
          return caches.match('./index.html');
        })
    );
  } else {
    // Cache-first voor overige bestanden (iconen, fonts, manifest)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (!res || res.status !== 200) return res;
          caches.open(CACHE_NAAM).then(cache => cache.put(event.request, res.clone()));
          return res;
        }).catch(() => {});
      })
    );
  }
});

// ── SYNC: Achtergrond-sync (toekomstige uitbreiding) ──────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bestellingen') {
    console.log('[SW] Achtergrond sync getriggerd');
  }
});

// ── PUSH: Notificaties (toekomstige uitbreiding) ──────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Emondt', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './favicon-32.png',
    })
  );
});

