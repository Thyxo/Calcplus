// Service worker: alt caches ved installation, så appen virker 100 % offline.
// Hæv VERSION ved ændringer, så telefonen henter den nye udgave.
const VERSION = 'calcplus-v3';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'src/app.js',
  'src/calculator.js',
  'src/force.js',
  'src/format.js',
  'src/settings.js',
  'src/selftest.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/favicon-32.png',
  ...['back', 'pct', 'pm', 'comma', 'div', 'mul', 'sub', 'add', 'eq', 'clock', 'calc',
    'm-check', 'm-basic', 'm-sci', 'm-notes', 'm-conv'].map((g) => `glyphs/${g}.png`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Netværk først, så en ny version slår igennem med det samme; cachen bruges offline
// (og hvis netværket er langsomt, efter 2,5 sek.).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    });
    const timeout = new Promise((r) => setTimeout(r, 2500));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch { /* offline */ }
    const cached = await cache.match(key, { ignoreSearch: true });
    return cached || network;
  })());
});
