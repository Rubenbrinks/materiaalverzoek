// ── Emondt Materiaalapp – Service Worker ──────────────────────
// Versie: bump dit getal na elke app-update om cache te vernieuwen
const CACHE_NAAM = 'emondt-materiaalapp-v2.1.5';

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
      // Fonts zijn cross-origin, cache ze apart met no-cors
      const lokaal = TE_CACHEN.filter(url => !url.startsWith('http'));
      const extern = TE_CACHEN.filter(url => url.startsWith('http'));
      return cache.addAll(lokaal).then(() =>
        Promise.all(
          extern.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(res => cache.put(url, res))
              .catch(() => {}) // Fonts zijn optioneel
          )
        )
      );
    }).then(() => {
      console.log('[SW] Installatie voltooid');
      return self.skipWaiting();
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
      return self.clients.claim();
    })
  );
});

// ── FETCH: Cache-first strategie ──────────────────────────────
// Probeer eerst de cache, dan het netwerk.
// Zo werkt de app volledig offline na het eerste bezoek.
self.addEventListener('fetch', event => {
  // Sla POST-verzoeken (mailto) over
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Gevonden in cache: stuur terug en update op achtergrond
        const netFetch = fetch(event.request)
          .then(res => {
            if (res && res.status === 200 && res.type !== 'opaque') {
              caches.open(CACHE_NAAM).then(cache => cache.put(event.request, res.clone()));
            }
            return res;
          })
          .catch(() => {}); // Geen netwerk = geen probleem, cache volstaat
        return cached;
      }

      // Niet in cache: probeer netwerk, sla daarna op in cache
      return fetch(event.request)
        .then(res => {
          if (!res || res.status !== 200) return res;
          const clone = res.clone();
          caches.open(CACHE_NAAM).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => {
          // Offline en niet gecached: toon de app-pagina als fallback
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ── SYNC: Achtergrond-sync (toekomstige uitbreiding) ──────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bestellingen') {
    console.log('[SW] Achtergrond sync getriggerd');
    // Uitbreidbaar: verstuur gecachte bestellingen als online
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
