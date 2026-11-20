// Titik masuk aplikasi: autentikasi, navigasi, router, sinkronisasi draft.
import * as api from './api.js';
import { icon } from './icons.js';
import { $, $$, esc, toast, openSheet, confirmDialog, withBusy } from './ui.js';
import { pendingDrafts, clearDraft, saveDraft, getPref } from './lib/drafts.js';
import * as dashboard from './pages/dashboard.js';
import * as nota from './pages/nota.js';
import * as orders from './pages/orders.js';
import * as rekap from './pages/rekap.js';
import * as expenses from './pages/expenses.js';
import * as reports from './pages/reports.js';
import * as settingsPage from './pages/settings.js';

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', short: 'Beranda', icon: 'home', href: '#/' },
  { id: 'nota', label: 'Buat Nota', short: 'Nota', icon: 'plus', href: '#/nota' },
  { id: 'orders', label: 'Data Penjualan', short: 'Penjualan', icon: 'list', href: '#/order' },
  { id: 'rekap', label: 'Rekap Harian', short: 'Rekap', icon: 'calendar', href: '#/rekap' },
  { id: 'expenses', label: 'Pengeluaran', short: 'Biaya', icon: 'wallet', href: '#/pengeluaran' },
  { id: 'reports', label: 'Laporan Keuangan', short: 'Laporan', icon: 'chart', href: '#/laporan' },
  { id: 'settings', label: 'Pengaturan', short: 'Pengaturan', icon: 'settings', href: '#/pengaturan' },
];

const ROUTES = [
  { re: /^\/?$/, nav: 'dashboard', page: dashboard, title: 'Dashboard' },
  { re: /^\/nota\/?$/, nav: 'nota', page: nota, title: 'Buat Nota', params: () => ({ mode: 'new' }) },
  { re: /^\/nota\/ubah\/([\w-]+)$/, nav: 'nota', page: nota, title: 'Ubah Transaksi', params: (m) => ({ mode: 'edit', id: m[1] }) },
  { re: /^\/nota\/duplikat\/([\w-]+)$/, nav: 'nota', page: nota, title: 'Duplikasi Transaksi', params: (m) => ({ mode: 'dup', id: m[1] }) },
  { re: /^\/nota\/hasil\/([\w-]+)$/, nav: 'nota', page: nota, title: 'Nota Tersimpan', params: (m) => ({ mode: 'result', id: m[1] }) },
  { re: /^\/order\/?$/, nav: 'orders', page: orders, title: 'Data Penjualan', params: () => ({}) },
  { re: /^\/order\/([\w-]+)$/, nav: 'orders', page: orders, title: 'Detail Transaksi', params: (m) => ({ id: m[1] }) },
  { re: /^\/rekap\/?$/, nav: 'rekap', page: rekap, title: 'Rekap Harian' },
  { re: /^\/pengeluaran\/?$/, nav: 'expenses', page: expenses, title: 'Pengeluaran' },
  { re: /^\/laporan\/?$/, nav: 'reports', page: reports, title: 'Laporan Keuangan' },
  { re: /^\/pengaturan\/?$/, nav: 'settings', page: settingsPage, title: 'Pengaturan' },
];

// Konteks bersama untuk semua halaman.
export const ctx = {
  settings: null,
  serviceCategories: [],
  expenseCategories: [],
  user: null,
  profile: null,
  navigate(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  },
  async refreshMasterData() {
    const [settings, svc, exp] = await Promise.all([
      api.loadSettings(),
      api.listCategories('service_categories'),
      api.listCategories('expense_categories'),
    ]);
    ctx.settings = settings;
    ctx.serviceCategories = svc;
    ctx.expenseCategories = exp;
    applyBranding();
  },
  serviceName(id) {
    return ctx.serviceCategories.find((s) => s.id === id)?.name ?? null;
  },
  query() {
    const q = location.hash.split('?')[1] || '';
    return Object.fromEntries(new URLSearchParams(q));
  },
};

let cleanup = null;
let started = false;

// ---------------------------------------------------------------- Boot
async function boot() {
  applyFontPref();
  registerSW();
  window.addEventListener('online', onConnectionChange);
  window.addEventListener('offline', onConnectionChange);
  onConnectionChange();

  if (!api.isConfigured()) {
    hideSplash();
    renderSetupNeeded();
    return;
  }
  api.init();
  api.onAuthChange((event, session) => {
    if (event === 'SIGNED_OUT') { started = false; renderLogin(); }
    if (event === 'PASSWORD_RECOVERY') { promptNewPassword(); }
    if (event === 'SIGNED_IN' && session && !started) startApp();
  });
  let session = null;
  try {
    session = await withTimeout(api.getSession(), 10000);
  } catch (e) {
    if (e?.timeout) { hideSplash(); renderSlowStart(); return; }
    /* offline / error lain: lanjut ke layar login */
  }
  hideSplash();
  if (session) startApp(); else renderLogin();
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('timeout'), { timeout: true })), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Ditampilkan bila pengecekan sesi ke server terlalu lama (mis. sinyal lemah). */
function renderSlowStart() {
  $('#app').hidden = true;
  const el = $('#login');
  el.hidden = false;
  el.innerHTML = `<div class="login-card">
    <img src="icons/icon-192.png" alt="" class="login-logo" width="88" height="88">
    <h1>Koneksi lambat</h1>
    <p class="muted" style="margin:8px 0 18px">Server belum merespons. Periksa sinyal atau koneksi internet, lalu coba lagi.</p>
    <button class="btn btn-accent btn-block btn-lg" id="btn-retry-boot">${icon('refresh')} Coba lagi</button>
    <button class="btn btn-link btn-block" id="btn-reset-app">Masih gagal? Perbarui aplikasi</button>
  </div>`;
  $('#btn-retry-boot').onclick = () => location.reload();
  $('#btn-reset-app').onclick = () => window.HB_RESET_APP?.();
}

function hideSplash() {
  const s = $('#splash');
  if (!s) return;
  s.classList.add('hide');
  setTimeout(() => s.remove(), 400);
}

async function startApp() {
  if (started) return;
  started = true;
  $('#login').hidden = true;
  $('#app').hidden = false;
  renderShell();
  try {
    const p = await api.getProfile();
    ctx.user = p?.user; ctx.profile = p?.profile;
    await ctx.refreshMasterData();
    if (ctx.profile && !ctx.profile.is_owner) {
      $('#main').innerHTML = `<div class="page"><div class="card notice notice-danger">${icon('alert')}
        <div><b>Akun ini bukan akun pemilik.</b><p>Aplikasi hanya dapat digunakan oleh akun pemilik usaha.</p>
        <button class="btn btn-ghost" id="btn-out2">${icon('logout')} Keluar</button></div></div></div>`;
      $('#btn-out2').onclick = logout;
      return;
    }
  } catch (e) {
    toast(e.message || 'Gagal memuat data awal.', 'error');
  }
  window.addEventListener('hashchange', route);
  route();
  syncPendingDrafts();
}

// ---------------------------------------------------------------- Shell
function renderShell() {
  const side = NAV.map((n) => `
    <a href="${n.href}" class="side-link" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('');
  $('#sidebar-links').innerHTML = side + `
    <button class="side-link side-logout" id="btn-logout-side">${icon('logout')}<span>Keluar</span></button>`;
  const link = (id) => {
    const n = NAV.find((x) => x.id === id);
    return `<a href="${n.href}" class="bn-link" data-nav="${n.id}">${icon(n.icon)}<span>${n.short}</span></a>`;
  };
  $('#bottom-nav').innerHTML = [
    link('dashboard'),
    link('orders'),
    `<a href="#/nota" class="bn-fab" data-nav="nota" aria-label="Buat Nota"><span class="bn-fab-circle">${icon('plus')}</span><span>Nota</span></a>`,
    link('expenses'),
    `<button class="bn-link" id="btn-more" data-nav="more">${icon('menu')}<span>Lainnya</span></button>`,
  ].join('');
  $('#btn-more').onclick = openMoreMenu;
  $('#btn-logout-side').onclick = logout;
  applyBranding();
}

function applyBranding() {
  const biz = ctx.settings?.business;
  if (!biz) return;
  $$('[data-brand-name]').forEach((el) => { el.textContent = biz.name || 'HANS BATIK'; });
  $$('[data-brand-tagline]').forEach((el) => { el.textContent = biz.tagline || ''; });
}

function openMoreMenu() {
  const items = ['rekap', 'reports', 'settings'].map((id) => NAV.find((n) => n.id === id));
  const s = openSheet({
    title: 'Menu lainnya',
    content: `<nav class="more-menu">
      ${items.map((n) => `<a href="${n.href}" class="more-link">${icon(n.icon)}<span>${n.label}</span>${icon('right', 'chev')}</a>`).join('')}
      <button class="more-link more-logout" data-logout>${icon('logout')}<span>Keluar</span></button>
    </nav>`,
  });
  s.el.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => s.close()));
  s.el.querySelector('[data-logout]').onclick = () => { s.close(); logout(); };
}

async function logout() {
  const ok = await confirmDialog({ title: 'Keluar dari aplikasi?', message: 'Anda perlu login lagi untuk membuka data.', okText: 'Keluar' });
  if (!ok) return;
  if (cleanup) { try { cleanup(); } catch { /* abaikan */ } cleanup = null; }
  await api.signOut();
  started = false;
  renderLogin();
}

// ---------------------------------------------------------------- Router
async function route() {
  if (!started) return;
  const path = location.hash.replace(/^#/, '').split('?')[0] || '/';
  let match = null; let r = null;
  for (const x of ROUTES) { match = path.match(x.re); if (match) { r = x; break; } }
  if (!r) { location.hash = '#/'; return; }

  if (cleanup) { try { cleanup(); } catch { /* abaikan */ } cleanup = null; }
  const inMore = ['rekap', 'reports', 'settings'].includes(r.nav);
  $$('[data-nav]').forEach((el) => el.classList.toggle('active',
    el.dataset.nav === r.nav || (el.dataset.nav === 'more' && inMore)));
  $('#page-title').textContent = r.title;
  document.title = `${r.title} · ${ctx.settings?.business?.name || 'Hans Batik'}`;

  const main = $('#main');
  const root = document.createElement('div');
  root.className = 'page';
  main.replaceChildren(root);
  window.scrollTo(0, 0);
  try {
    const res = await r.page.render(root, r.params ? r.params(match) : {}, ctx);
    if (typeof res === 'function') cleanup = res;
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card notice notice-danger">${icon('alert')}<div><b>Halaman gagal dimuat</b><p>${esc(e.message || e)}</p></div></div>`;
  }
}

// ---------------------------------------------------------------- Login
function renderLogin() {
  $('#app').hidden = true;
  const el = $('#login');
  el.hidden = false;
  el.innerHTML = `
    <div class="login-card">
      <img src="icons/icon-192.png" alt="" class="login-logo" width="88" height="88">
      <h1 data-brand-name>HANS BATIK</h1>
      <p class="tagline" data-brand-tagline>Batik Tulis &amp; Batik Cap</p>
      <form id="login-form" novalidate>
        <label class="field"><span class="field-label">Email</span>
          <input type="email" name="email" autocomplete="username" required inputmode="email" placeholder="email@contoh.com"></label>
        <label class="field"><span class="field-label">Password</span>
          <input type="password" name="password" autocomplete="current-password" required minlength="6" placeholder="••••••••"></label>
        <button class="btn btn-accent btn-block btn-lg" type="submit">Masuk</button>
        <button class="btn btn-link btn-block" type="button" id="btn-forgot">Lupa password?</button>
      </form>
      <p class="login-foot">Aplikasi manajemen khusus pemilik usaha.</p>
    </div>`;
  const form = $('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) { toast('Isi email dan password.', 'error'); return; }
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        await api.signIn(email, password);
        document.getElementById("toasts").replaceChildren();
        startApp();
      } catch (err) { toast(err.message, 'error'); }
    }, 'Masuk…');
  });
  $('#btn-forgot').onclick = async () => {
    const email = form.email.value.trim();
    if (!email) { toast('Isi email terlebih dahulu.', 'error'); return; }
    try {
      await api.resetPassword(email);
      toast('Link atur ulang password telah dikirim ke email.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };
}

function promptNewPassword() {
  const s = openSheet({
    title: 'Buat password baru',
    content: `<form id="pw-form"><label class="field"><span class="field-label">Password baru (min. 8 karakter)</span>
      <input type="password" name="pw" minlength="8" required autocomplete="new-password"></label>
      <button class="btn btn-primary btn-block" type="submit">Simpan password</button></form>`,
  });
  s.el.querySelector('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = e.target.pw.value;
    if (pw.length < 8) { toast('Password minimal 8 karakter.', 'error'); return; }
    try { await api.updatePassword(pw); toast('Password berhasil diperbarui.', 'success'); s.close(); } catch (err) { toast(err.message, 'error'); }
  });
}

function renderSetupNeeded() {
  $('#app').hidden = true;
  const el = $('#login');
  el.hidden = false;
  el.innerHTML = `<div class="login-card">
    <img src="icons/icon-192.png" alt="" class="login-logo" width="88" height="88">
    <h1>Konfigurasi belum lengkap</h1>
    <p class="muted">Variabel <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> belum diisi.
    Atur di Netlify → Site settings → Environment variables, lalu deploy ulang. Lihat README.</p></div>`;
}

// ---------------------------------------------------------------- Offline & draft
function onConnectionChange() {
  const bar = $('#offline-bar');
  if (!bar) return;
  bar.hidden = navigator.onLine;
  if (navigator.onLine && started) syncPendingDrafts();
}

let syncing = false;
/**
 * Kirim ulang nota yang gagal tersimpan saat offline. Aman: server memakai
 * client_request_id sehingga nota yang sama tidak akan pernah tersimpan dua kali.
 */
async function syncPendingDrafts() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const { key, draft } of pendingDrafts()) {
      try {
        const saved = await api.saveOrder(draft.payload);
        clearDraft(key);
        toast(`Nota ${saved.invoice_number} yang tertunda berhasil disimpan.`, 'success', 5000);
        if (location.hash.startsWith('#/nota') && !location.hash.includes('/hasil/')) {
          ctx.navigate(`#/nota/hasil/${saved.id}`);
        }
      } catch (e) {
        if (!e.offline) {
          // Ditolak server (mis. data tidak valid): kembalikan sebagai draft biasa.
          saveDraft(key, { ...draft, pendingSave: false });
          toast(`Nota tertunda gagal disimpan: ${e.message}`, 'error', 6000);
        }
      }
    }
  } finally {
    syncing = false;
  }
}

function applyFontPref() {
  document.documentElement.dataset.font = getPref('font', 'normal');
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ });
    });
  }
}

boot();
