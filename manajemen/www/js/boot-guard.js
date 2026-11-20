// Pengaman layar pembuka (script biasa, dimuat paling awal).
// Jika aplikasi gagal dimuat atau macet, setelah beberapa detik layar pembuka
// menampilkan pesan + tombol "Muat ulang" dan "Perbarui aplikasi", bukan loading terus.
(function () {
  var lastError = '';
  window.addEventListener('error', function (e) {
    lastError = (e && (e.message || (e.target && e.target.src && 'Gagal memuat ' + e.target.src))) || lastError;
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    lastError = (r && (r.message || String(r))) || lastError;
  });

  // Hapus service worker & cache lalu muat ulang (memperbaiki versi lama yang tersangkut).
  window.KR_RESET_APP = function () {
    var tasks = [];
    try {
      if ('serviceWorker' in navigator) {
        tasks.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }));
      }
      if (window.caches) {
        tasks.push(caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }));
      }
    } catch (err) { /* abaikan */ }
    Promise.all(tasks).catch(function () {}).then(function () { location.reload(); });
  };

  setTimeout(function () {
    var splash = document.getElementById('splash');
    var help = document.getElementById('splash-help');
    if (!splash || !help || splash.classList.contains('hide')) return;
    help.hidden = false;
    help.innerHTML =
      '<p class="splash-msg">Aplikasi belum siap. Periksa koneksi internet.</p>' +
      (lastError ? '<p class="splash-err"></p>' : '') +
      '<button type="button" class="btn btn-accent" id="splash-reload">Muat ulang</button>' +
      '<button type="button" class="btn btn-link splash-link" id="splash-reset">Perbarui aplikasi</button>';
    if (lastError) help.querySelector('.splash-err').textContent = 'Detail: ' + lastError;
    document.getElementById('splash-reload').onclick = function () { location.reload(); };
    document.getElementById('splash-reset').onclick = window.KR_RESET_APP;
  }, 15000);
})();
