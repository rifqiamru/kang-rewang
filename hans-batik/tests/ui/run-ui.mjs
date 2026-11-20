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
await page.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.HB_CONFIG={SUPABASE_URL:"https://demo.supabase.co",SUPABASE_ANON_KEY:"demo"};' }));
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
  await page.fill('[name=email]', 'pemilik@hansbatik.id');
  await page.fill('[name=password]', 'salah');
  await page.click('#login-form [type=submit]');
  await page.waitForSelector('.toast-error');
  await page.fill('[name=password]', 'rahasia123');
  await page.click('#login-form [type=submit]');
  await page.waitForSelector('.hero');
  ok('login (password salah ditolak, benar diterima)');
  await shot('02-dashboard-kosong');

  // ---------- Nota A: WhatsApp, dua barang, ongkir, alamat & resi, Lunas, Selesai
  await go('#/nota');
  await page.fill('[name=customer_name]', 'Budi');
  await page.fill('[name=customer_phone]', '0812-3456-789');
  await page.click('.chip:has-text("WhatsApp")');
  await page.fill('.item-row >> nth=0 >> [data-f=item_name]', 'Kemeja batik cap (L)');
  await page.fill('.item-row >> nth=0 >> [data-f=quantity]', '2');
  await page.fill('.item-row >> nth=0 >> [data-f=unit_price]', '175000');
  await page.click('#btn-add-item');
  await page.fill('.item-row >> nth=1 >> [data-f=item_name]', 'Kain batik tulis parang');
  await page.fill('.item-row >> nth=1 >> [data-f=unit_price]', '475000');
  await page.fill('[name=shipping_fee]', '20000');
  await page.click('details.more summary');
  await page.fill('[name=shipping_address]', 'Jl. Merdeka 1, Purwokerto');
  await page.fill('[name=courier]', 'JNE REG');
  await page.fill('[name=tracking_number]', 'JNE123');
  assert.ok(await page.isChecked('input[name=payment_status][value=Lunas]'), 'bawaan: Lunas');
  assert.ok(await page.isChecked('input[name=order_status][value=Selesai]'), 'bawaan: Selesai');
  assert.equal(await page.inputValue('.item-row >> nth=1 >> [data-f=unit_price]'), '475.000', 'format ribuan saat mengetik');
  assert.equal(await text('#bar-total'), 'Rp845.000');
  assert.match(await text('#calc-box'), /Pendapatan penjualan\s*Rp825\.000/);
  assert.match(await text('#calc-box'), /Ongkir & titipan\s*Rp20\.000/);
  ok('pratinjau nota A (total 845.000, penjualan 825.000, ongkir 20.000)');
  await shot('03-buat-nota');
  // Klik ganda pada tombol simpan → hanya satu transaksi
  await page.dblclick('#btn-save');
  await page.waitForSelector('.success-head');
  const notaA = await text('.wa-preview');
  assert.ok(notaA.includes(`📋 No. Nota  : HB-${yymm}001`), 'nomor nota A');
  assert.ok(notaA.includes('   2x Rp 175.000 = Rp 350.000'));
  assert.ok(notaA.includes('   🚚 Ongkos kirim = Rp 20.000'));
  assert.ok(notaA.includes('   💰 *TOTAL: Rp 845.000*'));
  assert.ok(notaA.includes('👤 Pelanggan : Budi'));
  assert.ok(notaA.includes('🔢 Resi   : JNE123'));
  assert.equal(await page.evaluate(() => window.__db.orders.length), 1, 'klik ganda tidak membuat transaksi ganda');
  ok('simpan nota A + klik ganda tetap 1 transaksi + format nota WA');
  await shot('04-nota-tersimpan');

  // Nota PDF berkop: unduh & bagikan (headless tidak bisa berbagi file → diunduh)
  const [pdfDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-pdf=download]')]);
  assert.equal(pdfDl.suggestedFilename(), `Nota-HB-${yymm}001.pdf`);
  const pdfBytes = readFileSync(await pdfDl.path());
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-', 'file PDF valid');
  assert.ok(pdfBytes.length > 5000, 'PDF berisi kop & logo');
  const [pdfDl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-pdf=share]')]);
  assert.equal(pdfDl2.suggestedFilename(), `Nota-HB-${yymm}001.pdf`);
  ok('nota PDF berkop: unduh & bagikan');

  await page.click('#btn-copy');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, notaA);
  await page.click('#btn-wa');
  await page.waitForTimeout(400);
  assert.ok(popups.some((u) => u.startsWith('https://wa.me/628123456789?text=')), 'link WA ke nomor pelanggan');
  ok('tombol Salin Teks Nota & Kirim ke WhatsApp');

  // ---------- Nota B: penjualan toko, satu barang
  await page.click('a:has-text("Buat Nota Baru")');
  await page.waitForSelector('#nota-form');
  assert.equal(await page.inputValue('[name=customer_name]'), '', 'formulir baru kosong setelah tersimpan');
  await page.fill('[name=customer_name]', 'Ani');
  await page.click('.chip:has-text("Penjualan Toko")');
  await page.fill('.item-row >> nth=0 >> [data-f=item_name]', 'Selendang batik');
  await page.fill('.item-row >> nth=0 >> [data-f=unit_price]', '75000');
  await page.click('#btn-save');
  await page.waitForSelector('.success-head');
  const notaB = await text('.wa-preview');
  assert.ok(notaB.includes(`HB-${yymm}002`));
  assert.ok(notaB.includes('1. Selendang batik'));
  assert.ok(notaB.includes('💰 *TOTAL: Rp 75.000*'));
  assert.ok(!notaB.includes('Ongkos kirim'));
  ok('nota B penjualan toko + nomor urut berikutnya');

  // ---------- Pengeluaran
  await go('#/pengeluaran');
  for (const [cat, amt, desc] of [['Pembelian kain / bahan', '300000', 'Kain primisima 10 m'], ['Kemasan', '25000', 'Paper bag']]) {
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
  assert.match(await text('#totals'), /Hari ini\s*Rp325\.000/);
  ok('catat pengeluaran kain & kemasan, total harian Rp325.000');
  await shot('05-pengeluaran');

  // ---------- Konsistensi angka: Dashboard, Rekap, Laporan
  await go('#/');
  await page.waitForSelector('.hero');
  const hero = await text('.hero');
  assert.match(hero, /Rp575\.000/);
  assert.match(hero, /Transaksi\s*2/);
  assert.match(hero, /Uang masuk\s*Rp920\.000/);
  assert.match(hero, /Penjualan\s*Rp900\.000/);
  assert.match(hero, /Pengeluaran\s*Rp325\.000/);
  assert.match(await text('.balance-card'), /Saldo usaha\s*Rp575\.000/, 'saldo = penjualan 900.000 − biaya 325.000 (ongkir tidak masuk)');
  ok('Dashboard: laba 575.000, 2 transaksi, uang masuk 920.000, penjualan 900.000, biaya 325.000, saldo 575.000');
  await shot('06-dashboard');

  await go('#/rekap');
  await page.waitForSelector('.wa-preview');
  const rekap = await text('.wa-preview');
  const lines = rekap.split('\n');
  for (const l of ['REKAP KAS HARIAN', 'Saldo Awal: Rp 0', 'Pemasukan:', '- Budi: Rp 825.000', '- Ani: Rp 75.000',
    'Total Pemasukan: Rp 900.000', 'Pengeluaran:', '- Kain primisima 10 m: Rp 300.000', '- Paper bag: Rp 25.000',
    'Total Pengeluaran: Rp 325.000', 'Saldo Akhir: Rp 575.000']) {
    assert.ok(lines.includes(l), 'rekap: ' + l);
  }
  assert.ok(!rekap.includes('845.000'), 'ongkir titipan tidak masuk rekap kas');
  ok('Rekap kas harian: pemasukan = penjualan, saldo akhir sama dengan dashboard');
  await shot('07-rekap');

  await go('#/laporan');
  await page.click('#periods [data-k=today]');
  await page.waitForTimeout(400);
  const lap = await text('.kv');
  assert.match(lap, /Total nilai transaksi\s*Rp920\.000/);
  assert.match(lap, /Total uang diterima\s*Rp920\.000/);
  assert.match(lap, /Total piutang\s*Rp0/);
  assert.match(lap, /Total ongkir & titipan.*\s*Rp20\.000/);
  assert.match(lap, /Total pendapatan penjualan\s*Rp900\.000/);
  assert.match(lap, /Total pengeluaran\s*Rp325\.000/);
  assert.match(lap, /Keuntungan bersih\s*Rp575\.000/);
  assert.match(lap, /Saldo usaha akhir periode\s*Rp575\.000/);
  ok('Laporan keuangan: 920.000 / 920.000 / 0 / 20.000 / 900.000 / 325.000 / 575.000');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-exp=orders]')]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert.ok(csv.startsWith('﻿No Nota,'), 'CSV ber-BOM & berjudul');
  assert.ok(csv.includes(`HB-${yymm}001`) && csv.includes('JNE123'));
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
  await page.click('.chip:has-text("Marketplace")');
  await page.fill('.item-row >> nth=0 >> [data-f=item_name]', 'Batik kombinasi');
  await page.fill('.item-row >> nth=0 >> [data-f=unit_price]', '300000');
  await page.fill('[name=shipping_fee]', '10000');
  await page.click('.seg label:has-text("DP")');
  await page.fill('[name=paid_amount]', '100000');
  assert.match(await text('#calc-box'), /Sisa pembayaran\s*Rp210\.000/);
  await context.setOffline(true);
  await page.evaluate(() => { window.__mockOffline = true; });
  await page.click('#btn-save');
  await page.waitForSelector('.toast-error');
  assert.match(await text('.toast-error'), /BELUM tersimpan/);
  assert.equal(await page.evaluate(() => window.__db.orders.filter((o) => o.customer_name === 'Citra').length), 0);
  assert.ok(await page.isVisible('#offline-bar'));
  await shot('09-offline', false);
  await page.waitForTimeout(300);
  await page.click('#btn-save');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__mockOffline = false; });
  await context.setOffline(false);
  await page.waitForSelector('.success-head', { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__db.orders.filter((o) => o.customer_name === 'Citra').length), 1, 'draft tertunda tersimpan sekali');
  ok('offline: tidak mengklaim tersimpan, draft dikirim otomatis saat online, tanpa duplikat');

  // ---------- Data penjualan: cari, detail, batalkan
  await go('#/order');
  await page.fill('#q', 'Budi');
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.order-card').count(), 1);
  await page.fill('#q', '');
  await page.waitForTimeout(800);
  await shot('10-data-penjualan');
  await page.click('.chip-btn[data-v=unpaid]');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.order-card').count(), 1, 'filter belum lunas → nota DP Citra');
  await page.click('.order-card');
  await page.waitForSelector('.detail-head');
  assert.ok(await page.isVisible('.pdf-card'), 'tombol PDF di detail');
  await shot('11-detail');
  await page.click('#btn-cancel');
  await page.click('[data-ok]');
  await page.waitForSelector('.detail-head.is-cancelled');
  ok('pencarian, filter belum lunas, detail (dengan PDF), batalkan transaksi');

  // Edit nota A → laporan ikut berubah
  await go('#/order');
  await page.fill('#q', 'Budi');
  await page.waitForTimeout(800);
  await page.click('.order-card');
  await page.waitForSelector('.detail-head');
  await page.click('a:has-text("Edit")');
  await page.waitForSelector('#nota-form');
  assert.equal(await page.inputValue('[name=tracking_number]'), 'JNE123', 'resi terbawa saat edit');
  await page.fill('.item-row >> nth=0 >> [data-f=quantity]', '3');
  await page.click('#btn-save');
  await page.waitForSelector('.detail-head');
  await go('#/');
  await page.waitForSelector('.hero');
  assert.match(await text('.hero'), /Penjualan\s*Rp1\.075\.000/, 'dashboard ikut berubah setelah edit');
  assert.match(await text('.hero'), /Transaksi\s*2/, 'transaksi batal tidak dihitung');
  ok('edit transaksi memperbarui dashboard; transaksi batal tidak dihitung');

  // ---------- Pengaturan: rekening bank → tampil di nota; kop nota PDF
  await go('#/pengaturan');
  await page.click('#set-bayar .switch:has-text("rekening bank")');
  await page.fill('#set-bayar [name=bank_name]', 'BCA');
  await page.fill('#set-bayar [name=bank_account]', '1234567890');
  await page.fill('#set-bayar [name=account_holder]', 'Hans');
  await page.click('#set-bayar [type=submit]');
  await page.waitForSelector('.toast-success');
  await page.click('#btn-preview');
  const prev = await text('.sheet .wa-preview');
  assert.ok(prev.includes('Bank BCA: 1234567890'), 'rekening tampil');
  assert.ok(!prev.includes('Dana'), 'Dana nonaktif tidak tampil');
  await page.click('.sheet [data-close]');
  ok('pengaturan pembayaran: rekening aktif tampil di nota, metode nonaktif tidak');

  await page.locator('#set-kop').scrollIntoViewIfNeeded();
  await page.setInputFiles('#logo-file', join(here, '..', '..', 'www', 'icons', 'icon-512.png'));
  await page.waitForFunction(() => document.querySelector('#logo-preview').src.startsWith('data:image/'));
  await page.fill('#set-kop [name=address]', 'Jl. Batik No. 1, Sokaraja, Banyumas');
  await page.fill('#set-kop [name=email]', 'toko@hansbatik.id');
  await page.click('#set-kop .seg label:has-text("A4")');
  await page.click('#set-kop [type=submit]');
  await page.waitForFunction(() => window.__db.settings.letterhead, null, { timeout: 5000 });
  const kop = await page.evaluate(() => window.__db.settings.letterhead);
  assert.equal(kop.address, 'Jl. Batik No. 1, Sokaraja, Banyumas');
  assert.equal(kop.paper, 'A4');
  assert.ok(kop.logo.startsWith('data:image/png;base64,') && kop.logo.length < 300000, 'logo diperkecil & tersimpan');
  await page.locator('#set-kop').screenshot({ path: join(shots, '12-pengaturan-kop.png') });
  const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#btn-kop-preview')]);
  assert.ok(popup, 'contoh PDF dibuka di tab baru');
  await popup.close();
  ok('pengaturan kop nota: logo, alamat, kertas A4, contoh PDF');

  // Saldo awal → saldo dashboard bertambah sebesar saldo awal
  await go('#/');
  await page.waitForSelector('.balance-card');
  const before = Number((await text('.bc-value')).replace(/[^0-9-]/g, ''));
  await page.click('.bc-link');
  await page.waitForSelector('#set-saldo');
  await page.fill('#set-saldo [name=opening_amount]', '100000');
  await page.click('#set-saldo [type=submit]');
  await page.waitForSelector('.toast-success');
  await page.waitForFunction(() => /Saldo saat ini/.test(document.querySelector('#saldo-now')?.textContent || ''));
  await go('#/');
  await page.waitForSelector('.balance-card');
  const after = Number((await text('.bc-value')).replace(/[^0-9-]/g, ''));
  assert.equal(after - before, 100000, `saldo awal menambah saldo: ${before} → ${after}`);
  ok('saldo awal di Pengaturan langsung menambah saldo di dashboard');

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

  // ---------- Layar pembuka tidak boleh loading selamanya
  // (a) Pengecekan sesi macet → layar "Koneksi lambat" + tombol coba lagi
  await page.evaluate(() => localStorage.setItem('hb.test.hang', '1'));
  await page.goto(BASE);
  await page.waitForSelector('#btn-retry-boot', { timeout: 13000 });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 2000 });
  await shot('16-koneksi-lambat', false);
  await page.evaluate(() => localStorage.removeItem('hb.test.hang'));
  ok('sesi macet: muncul layar Koneksi lambat (bukan loading terus)');

  // (b) Skrip aplikasi gagal dimuat → bantuan di layar pembuka
  const p2 = await context.newPage();
  await p2.route('**/js/app.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'throw new Error("uji gagal muat")' }));
  await p2.goto(BASE);
  await p2.waitForSelector('#splash-reload', { timeout: 18000 });
  assert.match(await p2.locator('#splash-help').innerText(), /uji gagal muat/);
  await p2.screenshot({ path: join(shots, '17-splash-bantuan.png') });
  await p2.close();
  ok('aplikasi gagal dimuat: layar pembuka menampilkan Muat ulang & Perbarui aplikasi');

  // (c) api.js ASLI + supabase-js asli, server tidak bisa dihubungi, ada sesi kedaluwarsa di HP
  const p3 = await context.newPage();
  const p3err = [];
  p3.on('pageerror', (e) => p3err.push(e.message));
  await p3.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript',
    body: 'window.HB_CONFIG={SUPABASE_URL:"http://127.0.0.1:9",SUPABASE_ANON_KEY:"eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.x"};' }));
  await p3.goto(BASE + 'favicon-placeholder');
  await p3.evaluate(() => localStorage.setItem('sb-127-auth-token', JSON.stringify({
    access_token: 'x.eyJleHAiOjF9.y', refresh_token: 'r', expires_at: 1, expires_in: 3600, token_type: 'bearer', user: { id: 'u' } })));
  await p3.goto(BASE);
  await p3.waitForSelector('#login-form, #btn-retry-boot', { timeout: 14000 });
  await p3.waitForSelector('#splash', { state: 'detached', timeout: 2000 });
  await p3.close();
  ok('supabase-js asli + server tak terjangkau: tidak tersangkut di layar pembuka');
  console.log(`\nSemua ${results.length} skenario UI LULUS. Tangkapan layar: ${shots}`);
} catch (e) {
  await shot('GAGAL').catch(() => {});
  console.error('\nGAGAL:', e.message, '\nError konsol:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
