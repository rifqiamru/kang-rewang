// Uji unit: format, perhitungan, teks nota & rekap.  Jalankan: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rupiah, formatNumber, parseAmount, parseQuantity, formatDateLong, todayJakarta,
  periodRange, startOfWeek, waNumber, cleanPhone, isValidPhone, rupiahShort,
} from '../www/js/lib/format.js';
import { computeOrder, summarize, itemSubtotal } from '../www/js/lib/calc.js';
import { buildNotaText, buildRekapText, mergeSettings, DEFAULT_SETTINGS, whatsappUrl } from '../www/js/lib/templates.js';
import { toCSV } from '../www/js/lib/csv.js';

test('format Rupiah tanpa desimal', () => {
  assert.equal(rupiah(91000), 'Rp91.000');
  assert.equal(rupiah(91000, { space: true }), 'Rp 91.000');
  assert.equal(rupiah(0), 'Rp0');
  assert.equal(rupiah(-5000), '-Rp5.000');
  assert.equal(rupiah(1234567.6), 'Rp1.234.568');
  assert.equal(formatNumber(1000000), '1.000.000');
  assert.equal(rupiahShort(1500000), '1,5 jt');
  assert.equal(rupiahShort(45000), '45 rb');
});

test('parse input angka', () => {
  assert.equal(parseAmount('Rp 23.000'), 23000);
  assert.equal(parseAmount(''), 0);
  assert.equal(parseAmount('-500'), 500);
  assert.equal(parseQuantity('1,5'), 1.5);
  assert.equal(parseQuantity('abc'), 0);
});

test('tanggal Asia/Jakarta', () => {
  assert.equal(formatDateLong('2026-11-19'), '19 November 2026');
  // 20 Nov 2026 18:30 UTC = 21 Nov 01:30 WIB
  assert.equal(todayJakarta(new Date('2026-11-20T18:30:00Z')), '2026-11-21');
  assert.equal(startOfWeek('2026-11-20'), '2026-11-16'); // Jumat → Senin
  assert.equal(startOfWeek('2026-11-22'), '2026-11-16'); // Minggu → Senin
  assert.deepEqual(periodRange('last_month', '2026-03-15'), { start: '2026-02-01', end: '2026-02-28', label: 'Bulan sebelumnya' });
  assert.deepEqual(periodRange('yesterday', '2026-01-01'), { start: '2025-12-31', end: '2025-12-31', label: 'Kemarin' });
});

test('nomor WhatsApp', () => {
  assert.equal(cleanPhone('0812-3456 789'), '08123456789');
  assert.equal(waNumber('0812 3456 789'), '628123456789');
  assert.equal(waNumber('+62 812 3456'), '628123456');
  assert.ok(isValidPhone(''));
  assert.ok(!isValidPhone('12'));
});

test('perhitungan nota: satu & beberapa barang', () => {
  const a = computeOrder({
    items: [{ item_name: 'Sanmol drop', quantity: 1, unit_price: 23000 },
            { item_name: 'Bakso', quantity: 1, unit_price: 48000 }],
    service_fee: 20000, payment_status: 'Lunas',
  });
  assert.equal(a.goods_total, 71000);
  assert.equal(a.total_amount, 91000);
  assert.equal(a.service_revenue, 20000);
  assert.equal(a.trust_amount, 71000);
  assert.equal(a.paid_amount, 91000);
  assert.equal(a.remaining_amount, 0);
  assert.deepEqual(a.errors, []);
  assert.equal(itemSubtotal(1.5, 10000), 15000);
});

test('perhitungan nota: tanpa barang, biaya tambahan, diskon, DP', () => {
  const b = computeOrder({ items: [], service_fee: 25000, payment_status: 'Belum Bayar' });
  assert.equal(b.total_amount, 25000);
  assert.equal(b.remaining_amount, 25000);
  const c = computeOrder({ items: [], service_fee: 20000, additional_fee: 5000, additional_fee_is_revenue: false,
    discount: 2000, payment_status: 'DP', paid_amount: 10000 });
  assert.equal(c.total_amount, 23000);
  assert.equal(c.service_revenue, 18000);
  assert.equal(c.trust_amount, 5000);
  assert.equal(c.remaining_amount, 13000);
  assert.deepEqual(c.errors, []);
  assert.ok(computeOrder({ service_fee: 1000, discount: 2000 }).errors.length);
  assert.ok(computeOrder({ service_fee: 1000, payment_status: 'DP', paid_amount: 1000 }).errors.length);
  assert.ok(computeOrder({ items: [{ item_name: '', quantity: 1, unit_price: 1 }] }).errors.length);
});

test('skenario keuangan wajib: 116.000 / 45.000 / 71.000 / 25.000 / 20.000', () => {
  const A = { ...computeOrder({ items: [{ item_name: 'x', quantity: 1, unit_price: 71000 }], service_fee: 20000, payment_status: 'Lunas' }), order_status: 'Selesai', payment_status: 'Lunas' };
  const B = { ...computeOrder({ items: [], service_fee: 25000, payment_status: 'Lunas' }), order_status: 'Selesai', payment_status: 'Lunas' };
  const X = { ...computeOrder({ items: [], service_fee: 99000, payment_status: 'Lunas' }), order_status: 'Dibatalkan', payment_status: 'Lunas' };
  const s = summarize([A, B, X], [{ amount: 20000 }, { amount: 5000 }]);
  assert.equal(s.total_value, 116000);
  assert.equal(s.service_revenue, 45000);
  assert.equal(s.trust_funds, 71000);
  assert.equal(s.expense_total, 25000);
  assert.equal(s.net_profit, 20000);
  assert.equal(s.order_count, 2);
  assert.equal(s.cancelled_count, 1);
});

const ORDER_A = {
  invoice_number: 'KR-2611001', transaction_date: '2026-11-19', customer_name: '',
  service_name: 'Titip Belanja', service_fee: 20000, additional_fee: 0, discount: 0,
  total_amount: 91000, paid_amount: 0, remaining_amount: 91000, payment_status: 'Belum Bayar',
  items: [
    { item_name: 'Sanmol drop', quantity: 1, unit_price: 23000, subtotal: 23000 },
    { item_name: 'Bakso taytoh 12 butir', quantity: 1, unit_price: 48000, subtotal: 48000 },
  ],
};

test('format nota WhatsApp sesuai standar', () => {
  const expected = [
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🛵 *NOTA KANG REWANG*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '📋 No. Nota  : KR-2611001',
    '📅 Tanggal   : 19 November 2026',
    '👤 Pelanggan : —',
    '🛠️ Layanan   : Titip Belanja',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🛍️ *RINCIAN:*',
    '',
    '1. Sanmol drop',
    '   1x Rp 23.000 = Rp 23.000',
    '2. Bakso taytoh 12 butir',
    '   1x Rp 48.000 = Rp 48.000',
    '   🛵 Ongkos jasa  = Rp 20.000',
    '   ━━━━━━━━━━━━━━━━━━━━━━',
    '   💰 *TOTAL: Rp 91.000*',
    '   ━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '💳 *INFO PEMBAYARAN:*',
    '🏦 Bank BRI : 137701013167504',
    '💙 Dana     : 081292923132',
    '🔳 QRIS     : Cek Katalog',
    '👤 a.n Rifqi Amrullah',
    '',
    'Terima kasih sudah pakai jasa Kang Rewang 🙏✨',
  ].join('\n');
  assert.equal(buildNotaText(ORDER_A, DEFAULT_SETTINGS), expected);
});

test('nota: tanpa barang, biaya tambahan, diskon, DP, metode nonaktif', () => {
  const settings = mergeSettings({ payment: { dana: { enabled: false } } });
  assert.equal(settings.payment.dana.number, '081292923132', 'merge mempertahankan nilai lain');
  const txt = buildNotaText({
    invoice_number: 'KR-2611002', transaction_date: '2026-11-20', customer_name: 'Ani',
    service_name: 'Antar Jemput', pickup_location: 'Pasar Wage', destination: 'Sokaraja', distance: 7.5,
    service_fee: 25000, additional_fee: 5000, discount: 2000, total_amount: 28000,
    paid_amount: 10000, remaining_amount: 18000, payment_status: 'DP', items: [],
  }, settings);
  assert.match(txt, /👤 Pelanggan : Ani/);
  assert.match(txt, /📍 Jemput : Pasar Wage/);
  assert.match(txt, /📏 Jarak  : 7,5 km/);
  assert.match(txt, /1\. Antar Jemput/);
  assert.match(txt, /➕ Biaya tambahan = Rp 5\.000/);
  assert.match(txt, /🏷️ Diskon = -Rp 2\.000/);
  assert.match(txt, /Sisa bayar : Rp 18\.000/);
  assert.doesNotMatch(txt, /Dana {5}:/);
  assert.doesNotMatch(txt, /undefined|NaN/);

  const noFee = buildNotaText({ ...ORDER_A, service_fee: 0, total_amount: 71000 });
  assert.doesNotMatch(noFee, /Ongkos jasa/);

  const noPay = buildNotaText(ORDER_A, mergeSettings({ payment: {
    bank: { enabled: false }, dana: { enabled: false }, qris: { enabled: false } } }));
  assert.doesNotMatch(noPay, /INFO PEMBAYARAN/);
});

test('rekap kas harian sesuai format pemilik', () => {
  const txt = buildRekapText({
    date: '2026-10-26',
    openingBalance: 404000,
    orders: [
      { invoice_number: 'KR-2610001', customer_name: 'Bu Ugi', service_name: 'Titip Belanja', order_status: 'Selesai',
        total_amount: 85000, goods_total: 70000, service_revenue: 15000 },
      { invoice_number: 'KR-2610002', customer_name: 'Pak Batal', order_status: 'Dibatalkan', service_revenue: 20000 },
      { invoice_number: 'KR-2610003', customer_name: 'Belum Selesai', order_status: 'Diproses', service_revenue: 10000 },
    ],
    expenses: [
      { category_name: 'Bensin', description: '', amount: 10000 },
      { category_name: 'Konsumsi', description: 'Haqi jajan', amount: 6000 },
    ],
  });
  assert.equal(txt, [
    'REKAP KAS HARIAN',
    'Senin, 26 Oktober 2026',
    '',
    'Saldo Awal: Rp 404.000',
    '',
    'Pemasukan:',
    '- Bu Ugi: Rp 15.000',
    'Total Pemasukan: Rp 15.000',
    '',
    'Pengeluaran:',
    '- Bensin: Rp 10.000',
    '- Haqi jajan: Rp 6.000',
    'Total Pengeluaran: Rp 16.000',
    '',
    'Saldo Akhir: Rp 403.000',
  ].join('\n'));
});

test('rekap kas: hari kosong & pelanggan tanpa nama', () => {
  const kosong = buildRekapText({ date: '2026-11-20', openingBalance: 50000 });
  assert.match(kosong, /Pemasukan:\n- Tidak ada\nTotal Pemasukan: Rp 0/);
  assert.match(kosong, /Saldo Akhir: Rp 50\.000$/);
  const tanpaNama = buildRekapText({ date: '2026-11-20', orders: [
    { invoice_number: 'KR-1', customer_name: '', service_name: 'Antar Jemput', order_status: 'Selesai', service_revenue: 20000 }] });
  assert.match(tanpaNama, /- Antar Jemput: Rp 20\.000/);
});

test('link WhatsApp & CSV', () => {
  assert.equal(whatsappUrl('a b', '628123'), 'https://wa.me/628123?text=a%20b');
  const csv = toCSV([['Nama', 'Total'], ['Budi, "Pak"', 91000]]);
  assert.equal(csv, '﻿Nama,Total\r\n"Budi, ""Pak""",91000');
});
