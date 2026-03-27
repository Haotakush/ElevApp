/**
 * ElevApp — Service Worker
 * Cache statique (app shell) + stratégie offline-first
 */

// ⚠️ IMPORTANT : Incrémenter cette version à chaque déploiement pour forcer le rechargement du cache chez les utilisateurs
const CACHE_NAME = 'elevapp-2026-03-27i';
const STATIC_ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/appcache.js',
  'js/storage.js',
  'js/utils.js',
  'js/db.js',
  'js/ui.js',
  'js/auth.js',
  'js/animals.js',
  'js/health.js',
  'js/dashboard.js',
  'js/exports.js',
  'js/cession.js',
  'js/registre.js',
  'js/autocontrole.js',
  'js/changelog.js',
  'js/externes.js',
  'js/portees.js',
  'js/conformite.js',
  'js/chaleurs.js',
  'js/ics.js',
  'js/notifications.js',
  'js/calendrier.js',
  'js/legal.js',
  'js/onboarding.js',
  'js/aide.js',
  'js/app.js',
  'manifest.json',
  'img/icons/icon-192.png',
  'img/icons/icon-512.png'
];

const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ---- Install : mettre en cache l'app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache static assets
      await cache.addAll(STATIC_ASSETS);
      // Cache external assets (non-bloquant)
      for (const url of EXTERNAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('SW: impossible de cacher', url);
        }
      }
    })
  );
  self.skipWaiting(); // Activer immédiatement sans attendre la fermeture des onglets
});

// ---- Message : skipWaiting sur demande explicite ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- Activate : nettoyer les anciens caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ---- Fetch : stratégie mixte ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Firebase / Firestore / Auth : network-only (laissé au SDK Firebase)
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('firebasestorage.googleapis.com')) {
    return;
  }

  // App shell (fichiers locaux) : cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Mettre à jour le cache en arrière-plan (stale-while-revalidate)
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => {
        // Offline fallback
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('index.html');
        }
      })
    );
    return;
  }

  // Ressources externes : cache-first avec fallback réseau
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Rien à faire, la ressource n'est pas disponible
    })
  );
});
