const CACHE='mein-haushalt-v027-static';
const ASSETS=['./','./index.html','./style.css?v=027','./app.js?v=027','./meal.js?v=027','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mein-haushalt-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const req=event.request;
 if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
 const url=new URL(req.url);
 // Network first ensures GitHub Pages updates appear when online; cached files remain available offline.
 event.respondWith(fetch(req, {cache:'no-store'}).then(response => {
  if(response.ok && response.type === 'basic') {
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{}));
  }
  return response;
 }).catch(async () => {
  const cached=await caches.match(req);
  if(cached) return cached;
  if(req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
  return Response.error();
 }));
});
