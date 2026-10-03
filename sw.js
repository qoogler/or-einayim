// אור עיניים · service worker: fast opening and a readable app when the network drops.
// Data always comes live from Supabase and is never cached here.
const VERSION = 'oe-v1.0.1';
const FONTS = 'oe-fonts';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css?v=2', './js/app.js?v=2',
  './js/vendor/supabase.js', './js/config.js', './js/content.js', './js/icons.js', './js/util.js', './js/store.js',
  './js/ui.js', './js/kinds.js', './js/logic.js', './js/sheets.js',
  './js/views/home.js', './js/views/worlds.js', './js/views/pages.js', './js/views/talk.js', './js/views/settings.js', './js/views/auth.js',
  './icons/icon-192.png', './icons/favicon.svg',
];
const INDEX = new URL('./index.html', self.location).toString();

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
      e.respondWith(caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }));
    }
    return; // Supabase and everything else: straight to the network
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(INDEX, copy)); return res; })
        .catch(() => caches.match(INDEX)),
    );
    return;
  }

  // App files: fresh from the network when online (so both phones always run the same version),
  // from the cache when offline or when the network is very slow.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 3500)),
      ]);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (_) {
      const hit = await cache.match(req);
      return hit || fetch(req);
    }
  })());
});
