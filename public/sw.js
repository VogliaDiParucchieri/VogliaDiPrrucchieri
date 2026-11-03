/* Service worker minimale: rende il sito installabile come app e lo apre anche con rete debole.
   Dati (/api), pannelli (/admin, /owner) e richieste non-GET passano sempre dalla rete. */
const CACHE = 'vdi-v1';
const SHELL = ['/', '/assets/css/site.css', '/assets/js/site.js', '/assets/img/logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => { })).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /^\/(api|admin|owner)(\/|$)/.test(u.pathname)) return;
  const img = u.pathname.startsWith('/assets/img/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (img) { // immagini: prima la copia salvata
      const hit = await cache.match(r); if (hit) return hit;
    }
    try { // pagine, css e js: prima la rete (così dopo un aggiornamento vedi subito la versione nuova)
      const res = await fetch(r);
      if (res.ok) cache.put(r, res.clone());
      return res;
    } catch {
      return (await cache.match(r)) || (r.mode === 'navigate' ? await cache.match('/') : Response.error());
    }
  })());
});
