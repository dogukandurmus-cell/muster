self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open('app-v1').then(cache =>
      cache.match(event.request).then(resp =>
        resp || fetch(event.request).then(r => {
          if (event.request.method === 'GET' && r.ok) cache.put(event.request, r.clone());
          return r;
        }).catch(() => resp)
      )
    )
  );
});
