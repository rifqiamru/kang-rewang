// Service worker Hans Batik.
// - Menyimpan "kerangka aplikasi" (HTML/CSS/JS/ikon) agar aplikasi cepat dibuka
//   dan tetap tampil saat offline.
// - TIDAK menyimpan data Supabase: semua permintaan ke server selalu lewat jaringan,
//   sehingga aplikasi tidak pernah menampilkan/mengklaim data tersimpan yang palsu.
const VERSION = 'hb-v1.0.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './vendor/supabase.js', './vendor/jspdf.umd.min.js', './js/config.js', './js/boot-guard.js',
  './js/app.js', './js/api.js', './js/ui.js', './js/icons.js',
  './js/lib/format.js', './js/lib/calc.js', './js/lib/templates.js', './js/lib/csv.js', './js/lib/drafts.js', './js/lib/chart.js', './js/lib/pdf.js',
  './js/pages/dashboard.js', './js/pages/nota.js', './js/pages/orders.js', './js/pages/rekap.js',
  './js/pages/expenses.js', './js/pages/reports.js', './js/pages/settings.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg', './icons/apple-touch-icon.png', './icons/logo-kop.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase & pihak lain: selalu jaringan

  // Network-first untuk file aplikasi agar pembaruan langsung terpakai;
  // jatuh ke cache saat offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
