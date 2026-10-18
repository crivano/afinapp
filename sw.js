/* Service worker do AfinApp — cache-first para funcionar 100% offline
   (inclusive a fonte Bravura, única dependência externa).
   Para publicar uma versão nova, aumente V: o cache antigo é descartado. */
const V = 'afinapp-v1';
const FONT = 'https://cdn.jsdelivr.net/gh/steinbergmedia/bravura@master/redist/woff/Bravura.woff';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(['./', './index.html', './manifest.webmanifest',
                    './icons/icon-192.png', './icons/icon-512.png',
                    './icons/icon-maskable-512.png', './icons/icon-180.png']);
    // Fonte Bravura (CDN): melhor esforço — se a 1ª visita for offline,
    // ela é cacheada na primeira carga online que passar pelo fetch abaixo.
    try { const r = await fetch(FONT, {mode:'cors'}); if (r.ok) await c.put(FONT, r); } catch(_){}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Cache-first para o próprio site e para a fonte Bravura; o resto (se
   algum dia existir) passa direto para a rede. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && url.href !== FONT) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, {ignoreSearch:true});
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque'))
        (await caches.open(V)).put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await caches.match('./')) || Response.error();
      throw err;
    }
  })());
});
