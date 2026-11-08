// KSRMS App Service Worker
// ಮುಖ್ಯ ನಿಯಮ: index.html ಯಾವಾಗಲೂ ಮೊದಲು ಇಂಟರ್ನೆಟ್‌ನಿಂದ (ಹೊಸ ಆವೃತ್ತಿ ತಕ್ಷಣ ಬರಲಿ),
// ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದಿದ್ದರೆ ಮಾತ್ರ ಉಳಿಸಿದ ಪ್ರತಿ. Firebase ಡೇಟಾ ವಿನಂತಿಗಳನ್ನು ಮುಟ್ಟುವುದಿಲ್ಲ.
const VERSION = 'ksrms-app-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const STATIC_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ಪೇಜ್ (index.html): Network-first
  if (req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // ಆವೃತ್ತಿ ಸಂಖ್ಯೆ ಇರುವ CDN ಫೈಲ್‌ಗಳು (Bootstrap, Firebase SDK, ಫಾಂಟ್): Cache-first
  if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // ಸ್ವಂತ ಸಣ್ಣ ಫೈಲ್‌ಗಳು (ಐಕಾನ್, manifest): Cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
  // ಉಳಿದವು (Firestore, Firebase Auth ಇತ್ಯಾದಿ) ನೇರವಾಗಿ ಇಂಟರ್ನೆಟ್‌ಗೆ — cache ಮಾಡುವುದಿಲ್ಲ
});
