// Offline-Cache. Bei jeder Änderung an der App VERSION erhöhen,
// damit das iPhone die neuen Dateien lädt.
const VERSION = 'v9';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/training.js',
  'js/nutrition.js',
  'js/sync.js',
  'js/recipes.js',
  'js/custom.js',
  'js/photo.js',
  'js/activity.js',
  'js/data/skills.js',
  'js/data/food.js',
  'js/data/mobility.js',
  'js/ui.js',
  'js/views/home.js',
  'js/views/plan.js',
  'js/views/exercises.js',
  'js/views/progress.js',
  'js/views/food.js',
  'js/views/profile.js',
  'js/views/player.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Erst Netzwerk (damit Updates sofort ankommen), offline aus dem Cache
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
