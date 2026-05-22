const CACHE='sr-tortinhas-v1-4';
const ASSETS=['./','./index.html','./styles.css','./app.js','./data-seed.js','./manifest.webmanifest','./logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
