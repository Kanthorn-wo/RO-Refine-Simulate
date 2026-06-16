// Service worker แบบอนุรักษ์นิยม — กัน build ค้าง (HTML network-first เสมอ)
// asset ที่ content-hash แล้ว (/assets/, /images/) ใช้ cache-first ปลอดภัย
const CACHE = 'ro-refine-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // ข้าม cross-origin (GA, Supabase ฯลฯ) และ API
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // หน้าเว็บ (navigation) — network-first กัน build เก่าค้าง, offline ค่อย fallback cache
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // static asset (hashed) — cache-first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/')) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
  }
});
