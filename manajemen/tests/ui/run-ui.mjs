// Uji antarmuka end-to-end (Playwright, layar HP) dengan API tiruan.
// Jalankan: npm run test:ui   → tangkapan layar di tests/ui/screenshots/
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const server = spawn(process.execPath, [join(here, '..', '..', 'scripts', 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const results = [];
const ok = (name) => { results.push(name); console.log('OK ', name); };

const browser = await pw.chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  serviceWorkers: 'block', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('**/js/api.js', (r) => r.fulfill({ contentType: 'text/javascript', body: readFileSync(join(here, 'mock-api.js'), 'utf8') }));
await page.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.KR_CONFIG={SUPABASE_URL:"https://demo.supabase.co",SUPABASE_ANON_KEY:"demo"};' }));
const popups = [];
await context.route('https://wa.me/**', (r) => { popups.push(r.request().url()); r.fulfill({ body: 'wa' }); });

const shot = (name, full = true) => page.screenshot({ path: join(shots, `${name}.png`), fullPage: full });
const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(450); };
const text = (sel) => page.locator(sel).first().innerText();
const yymm = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).replace(/^\d\d(\d\d)-(\d\d).*/, '$1$2');

try {
  // ---------- Login
  await page.goto(BASE);
  await page.waitForSelector('#login-form');
  await shot('01-login', false);
  await page.fill('[name=email]', 'pemilik@kangrewang.id');
  await page.fill('[name=password]', 'salah');
  await page.click('#login-form [type=submit]');
  await page.waitForSelector('.toast-error');
  await page.fill('[name=password]', 'rahasia123');
  await page.click('#login-form [type=submit]');
  await page.waitForSelector('.hero');
  ok('login (password salah ditolak, benar diterima)');
  await shot('02-dashboard-kosong');

  // ---------- Nota A: dua barang, ongkos jasa, Lunas, Selesai
  await go('#/nota');
  await page.fill('[name=customer_name]', 'Budi');
  await page.fill('[name=customer_phone]', '0812-3456-789');
  await page.check('input[name=service_category_id] >> nth=0', { force: true });
  await page.fill('.item-row >> nth=0 >> [data-f=item_name]', 'Sanmol drop');
  await page.fill('.item-row >> nth=0 >> [data-f=unit_price]', '23000');
  await page.click('#btn-add-item');
  await page.fill('.item-row >> nth=1 >> [data-f=item_name]', 'Bakso taytoh 12 butir');
  await page.fill('.item-row >> nth=1 >> [data-f=unit_price]', '48000');
  await page.fill('[name=service_fee]', '20000');
  await page.click('.seg label:has-text("Lunas")');
  await page.click('.seg label:has-text("Selesai")');
  assert.equal(await page.inputValue('.item-row >> nth=1 >> [data-f=unit_price]'), '48.000', 'format ribuan saat mengetik');
  assert.equal(await text('#bar-total'), 'Rp91.000');
  assert.match(await text('#calc-box'), /Pendapatan jasa\s*Rp20\.000/);
  assert.match(await text('#calc-box'), /Dana titipan\s*Rp71\.000/);
  ok('pratinjau perhitungan nota A (total 91.000, jasa 20.000, titipan 71.000)');
  await shot('03-buat-nota');
  // Klik ganda pada tombol simpan → hanya satu transaksi
  await page.dblclick('#btn-save');
  await page.waitForSelector('.success-head');
  const notaA = await text('.wa-preview');
  assert.ok(notaA.includes(`📋 No. Nota  : KR-${yymm}001`), 'nomor nota A');
  assert.ok(notaA.includes('   1x Rp 23.000 = Rp 23.000'));
  assert.ok(notaA.includes('   🛵 Ongkos jasa  = Rp 20.000'));
  assert.ok(notaA.includes('   💰 *TOTAL: Rp 91.000*'));
  assert.ok(notaA.includes('👤 Pelanggan : Budi'));
  assert.ok(notaA.includes('🏦 Bank BRI : 137701013167504'));
  assert.equal(await page.evaluate(() => window.__db.orders.length), 1, 'klik ganda tidak membuat transaksi ganda');
  ok('simpan nota A + klik ganda tetap 1 transaksi + format nota WA');
  await shot('04-nota-tersimpan');

  await page.click('#btn-copy');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, notaA);
  await page.click('#btn-wa');
  await page.waitForTimeout(400);
  assert.ok(popups.some((u) => u.startsWith('https://wa.me/628123456789?text=')), 'link WA ke nomor pelanggan');
  ok('tombol Salin Nota & Bagikan ke WhatsApp');

  // ---------- Nota B: tanpa barang (Pengiriman Barang), ongkos 25.000
  await page.click('a:has-text("Buat Nota Baru")');
  await page.waitForSelector('#nota-form');
  assert.equal(await page.inputValue('[name=customer_name]'), '', 'formulir baru kosong setelah tersimpan');
  await page.fill('[name=customer_name]', 'Ani');
  await page.click('.chip:has-text("Pengiriman Barang")');
  await page.click('.item-row [data-del]');
  await page.fill('[name=pickup_location]', 'Pasar Wage').catch(async () => { await page.click('details.more summary'); await page.fill('[name=pickup_location]', 'Pasar Wage'); });
  await page.fill('[name=destination]', 'Sokaraja');
  await page.fill('[name=service_fee]', '25000');
  await page.click('.seg label:has-text("Lunas")');
  await page.click('.seg label:has-text("Selesai")');
  await page.click('#btn-save');
  await page.waitForSelector('.success-head');
  const notaB = await text('.wa-preview');
  assert.ok(notaB.includes(`KR-${yymm}002`));
  assert.ok(notaB.includes('📍 Jemput : Pasar Wage'));
  assert.ok(notaB.includes('1. Pengiriman Barang'));
  assert.ok(notaB.includes('💰 *TOTAL: Rp 25.000*'));
  ok('nota B tanpa rincian barang + nomor urut berikutnya');

  // ---------- Pengeluaran
  await go('#/pengeluaran');
  for (const [cat, amt, desc] of [['Bensin', '20000', 'Isi bensin motor'], ['Parkir', '5000', 'Parkir pasar']]) {
    await page.click('#btn-add');
    await page.waitForSelector('#exp-form');
    await page.click(`#exp-form .chip:has-text("${cat}")`);
    await page.fill('#exp-form [name=amount]', amt);
    await page.fill('#exp-form [name=description]', desc);
    await page.click('#exp-form [type=submit]');
    await page.waitForSelector('#exp-form', { state: 'detached' });
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('.group');
  assert.match(await text('#totals'), /Hari ini\s*Rp25\.000/);
  ok('catat pengeluaran bensin & parkir, total harian Rp25.000');
  await shot('05-pengeluaran');

  // ---------- Konsistensi angka: Dashboard, Rekap, Laporan
  await go('#/');
  await page.waitForSelector('.hero');
  const hero = await text('.hero');
  assert.match(hero, /Rp20\.000/);
  assert.match(hero, /Transaksi\s*2/);
  assert.match(hero, /Uang masuk\s*Rp116\.000/);
  assert.match(hero, /Pendapatan jasa\s*Rp45\.000/);
  assert.match(hero, /Pengeluaran\s*Rp25\.000/);
  ok('Dashboard: laba 20.000, 2 transaksi, uang masuk 116.000, jasa 45.000, biaya 25.000');
  await shot('06-dashboard');

  await go('#/rekap');
  await page.waitForSelector('.wa-preview');
  const rekap = await text('.wa-preview');
  for (const l of ['Jumlah order: 2', 'Uang masuk pelanggan: Rp116.000', 'Pendapatan jasa: Rp45.000', 'Dana titipan belanja: Rp71.000',
    '1. Bensin: Rp20.000', '2. Parkir: Rp5.000', 'Total pengeluaran: Rp25.000', '*KEUNTUNGAN BERSIH: Rp20.000*']) {
    assert.ok(rekap.includes(l), 'rekap: ' + l);
  }
  ok('Rekap harian: angka sama dengan dashboard');
  await shot('07-rekap');

  await go('#/laporan');
  await page.click('#periods [data-k=today]');
  await page.waitForTimeout(400);
  const lap = await text('.kv');
  assert.match(lap, /Total nilai transaksi\s*Rp116\.000/);
  assert.match(lap, /Total uang diterima\s*Rp116\.000/);
  assert.match(lap, /Total piutang\s*Rp0/);
  assert.match(lap, /Total dana titipan.*\s*Rp71\.000/);
  assert.match(lap, /Total pendapatan jasa\s*Rp45\.000/);
  assert.match(lap, /Total pengeluaran\s*Rp25\.000/);
  assert.match(lap, /Keuntungan bersih\s*Rp20\.000/);
  ok('Laporan keuangan: 116.000 / 116.000 / 0 / 71.000 / 45.000 / 25.000 / 20.000');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-exp=orders]')]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert.ok(csv.startsWith('﻿No Nota,'), 'CSV ber-BOM & berjudul');
  assert.ok(csv.includes(`KR-${yymm}001`));
  ok('export CSV transaksi');

  await page.evaluate(() => window.__seedHistory());
  await page.click('#periods [data-k=month]');
  await page.waitForSelector('#chart-rev svg path');
  await page.hover('#chart-rev .hit >> nth=-1').catch(() => {});
  await page.dispatchEvent('#chart-rev .hit >> nth=-1', 'pointermove').catch(() => {});
  await shot('08-laporan-bulan');
  ok('grafik laporan bulanan tampil');

  // ---------- Offline: simpan gagal → draft tertunda → sinkron otomatis tanpa duplikat
  await go('#/nota');
  await page.fill('[name=customer_name]', 'Citra');
  await page.click('.chip:has-text("Jastip")');
  await page.fill('.item-row >> nth=0 >> [data-f=item_name]', 'Kue lapis');
  await page.fill('.item-row >> nth=0 >> [data-f=unit_price]', '30000');
  await page.fill('[name=service_fee]', '10000');
  await page.click('.seg label:has-text("DP")');
  await page.fill('[name=paid_amount]', '15000');
  assert.match(await text('#calc-box'), /Sisa pembayaran\s*Rp25\.000/);
  await context.setOffline(true);
  await page.evaluate(() => { window.__mockOffline = true; });
  await page.click('#btn-save');
  await page.waitForSelector('.toast-error');
  assert.match(await text('.toast-error'), /BELUM tersimpan/);
  assert.equal(await page.evaluate(() => window.__db.orders.filter((o) => o.customer_name === 'Citra').length), 0);
  assert.ok(await page.isVisible('#offline-bar'));
  await shot('09-offline', false);
  // Coba simpan lagi saat masih offline → tetap aman
  await page.waitForTimeout(300);
  await page.click('#btn-save');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__mockOffline = false; });
  await context.setOffline(false);
  await page.waitForSelector('.success-head', { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__db.orders.filter((o) => o.customer_name === 'Citra').length), 1, 'draft tertunda tersimpan sekali');
  ok('offline: tidak mengklaim tersimpan, draft dikirim otomatis saat online, tanpa duplikat');

  // ---------- Data order: cari, detail, batalkan
  await go('#/order');
  await page.fill('#q', 'Budi');
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.order-card').count(), 1);
  await page.fill('#q', '');
  await page.waitForTimeout(800);
  await shot('10-data-order');
  await page.click('.chip-btn[data-v=unpaid]');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.order-card').count(), 1, 'filter belum lunas → nota DP Citra');
  await page.click('.order-card');
  await page.waitForSelector('.detail-head');
  await shot('11-detail');
  await page.click('#btn-cancel');
  await page.click('[data-ok]');
  await page.waitForSelector('.detail-head.is-cancelled');
  ok('pencarian, filter belum lunas, detail, batalkan transaksi');

  // Edit nota A → laporan ikut berubah
  await go('#/order');
  await page.fill('#q', 'Budi');
  await page.waitForTimeout(800);
  await page.click('.order-card');
  await page.waitForSelector('.detail-head');
  await page.click('a:has-text("Edit")');
  await page.waitForSelector('#nota-form');
  await page.fill('[name=service_fee]', '30000');
  await page.click('#btn-save');
  await page.waitForSelector('.detail-head');
  await go('#/');
  await page.waitForSelector('.hero');
  assert.match(await text('.hero'), /Pendapatan jasa\s*Rp55\.000/, 'dashboard ikut berubah setelah edit');
  assert.match(await text('.hero'), /Transaksi\s*2/, 'transaksi batal tidak dihitung');
  ok('edit transaksi memperbarui dashboard; transaksi batal tidak dihitung');

  // ---------- Pengaturan: nonaktifkan Dana → hilang dari nota
  await go('#/pengaturan');
  await page.click('#set-bayar .switch:has-text("Dana")');
  await page.click('#set-bayar [type=submit]');
  await page.waitForSelector('.toast-success');
  await shot('12-pengaturan');
  await page.click('#btn-preview');
  const prev = await text('.sheet .wa-preview');
  assert.ok(!prev.includes('Dana     :'), 'Dana nonaktif tidak tampil');
  assert.ok(prev.includes('Bank BRI'));
  await page.click('.sheet [data-close]');
  ok('pengaturan pembayaran: metode nonaktif tidak tampil di nota');

  // ---------- Menu lainnya & desktop
  await go('#/');
  await page.click('#btn-more');
  await page.waitForSelector('.more-menu');
  await shot('13-menu-lainnya', false);
  await page.click('.sheet [data-close]');
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.waitForTimeout(400);
  await shot('14-desktop-dashboard', false);
  await page.setViewportSize({ width: 320, height: 640 });
  await go('#/nota');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, 'tidak ada scroll horizontal di layar 320px, selisih ' + overflow);
  await shot('15-layar-kecil-320');
  ok('tampilan desktop & layar kecil 320px tanpa scroll horizontal');

  // ---------- Logout
  await page.setViewportSize({ width: 390, height: 844 });
  await go('#/pengaturan');
  await page.click('#btn-logout');
  await page.click('[data-ok]');
  await page.waitForSelector('#login-form');
  ok('logout');

  assert.deepEqual(errors, [], 'tidak ada error JavaScript');
  ok('tidak ada error JavaScript di konsol');
  console.log(`\nSemua ${results.length} skenario UI LULUS. Tangkapan layar: ${shots}`);
} catch (e) {
  await shot('GAGAL').catch(() => {});
  console.error('\nGAGAL:', e.message, '\nError konsol:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
