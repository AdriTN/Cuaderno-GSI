/*
 * Service worker de Cuaderno GSI: permite abrir la app sin conexión.
 * - La página: primero la red (para recibir actualizaciones) y, si no hay conexión, la copia guardada.
 * - Iconos, manifiesto y tipografías: primero la copia guardada, actualizándola en segundo plano.
 * - Nunca guarda llamadas a la API de Anthropic.
 * La versión la pone el build; al cambiar, se borran las cachés antiguas.
 */
const VERSION = '__VERSION__';
const CACHE = `cuaderno-gsi-${VERSION}`;
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cuaderno-gsi-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname === 'api.anthropic.com') return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  const cacheable = url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;
  event.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(req);
    const network = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => cached);
    return cached ?? network;
  }));
});
