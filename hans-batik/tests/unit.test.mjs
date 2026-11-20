// Uji unit: format, perhitungan, teks nota & rekap.  Jalankan: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rupiah, formatNumber, parseAmount, parseQuantity, formatDateLong, todayJakarta,
  periodRange, startOfWeek, waNumber, cleanPhone, isValidPhone, rupiahShort, terbilang,
} from '../www/js/lib/format.js';
import { computeOrder, summarize, itemSubtotal } from '../www/js/lib/calc.js';
import { buildNotaText, buildRekapText, mergeSettings, DEFAULT_SETTINGS, whatsappUrl } from '../www/js/lib/templates.js';
import { toCSV } from '../www/js/lib/csv.js';
import { buildNotaPDF, pdfSafe, notaFileName } from '../www/js/lib/pdf.js';
import { loadJsPDFNode } from './helpers/jspdf-node.mjs';
import { readFileSync } from 'node:fs';

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

test('perhitungan nota: barang = pendapatan, ongkir = titipan', () => {
  const a = computeOrder({
    items: [{ item_name: 'Kemeja batik cap (L)', quantity: 2, unit_price: 175000 },
            { item_name: 'Kain batik tulis parang', quantity: 1, unit_price: 475000 }],
    shipping_fee: 20000, payment_status: 'Lunas',
  });
  assert.equal(a.goods_total, 825000);
  assert.equal(a.total_amount, 845000);
  assert.equal(a.sales_revenue, 825000);
  assert.equal(a.trust_amount, 20000);
  assert.equal(a.paid_amount, 845000);
  assert.equal(a.remaining_amount, 0);
  assert.deepEqual(a.errors, []);
  assert.equal(itemSubtotal(1.5, 10000), 15000);
});

test('perhitungan nota: biaya tambahan, diskon, DP', () => {
  const c = computeOrder({ items: [{ item_name: 'Daster', quantity: 1, unit_price: 100000 }], shipping_fee: 20000,
    additional_fee: 5000, additional_fee_is_revenue: false, discount: 2000, payment_status: 'DP', paid_amount: 50000 });
  assert.equal(c.total_amount, 123000);
  assert.equal(c.sales_revenue, 98000);
  assert.equal(c.trust_amount, 25000);
  assert.equal(c.remaining_amount, 73000);
  assert.deepEqual(c.errors, []);
  const jahit = computeOrder({ items: [{ item_name: 'Kain', quantity: 1, unit_price: 100000 }], additional_fee: 30000 });
  assert.equal(jahit.sales_revenue, 130000, 'biaya jahit = pendapatan');
  assert.ok(computeOrder({ shipping_fee: 1000, discount: 2000 }).errors.length);
  assert.ok(computeOrder({ shipping_fee: 1000, payment_status: 'DP', paid_amount: 1000 }).errors.length);
  assert.ok(computeOrder({ items: [{ item_name: '', quantity: 1, unit_price: 1 }] }).errors.length);
});

test('skenario keuangan toko: 920.000 / 900.000 / 20.000 / 325.000 / 575.000', () => {
  const A = { ...computeOrder({ items: [{ item_name: 'x', quantity: 1, unit_price: 825000 }], shipping_fee: 20000, payment_status: 'Lunas' }), order_status: 'Selesai', payment_status: 'Lunas' };
  const B = { ...computeOrder({ items: [{ item_name: 'y', quantity: 1, unit_price: 75000 }], payment_status: 'Lunas' }), order_status: 'Selesai', payment_status: 'Lunas' };
  const X = { ...computeOrder({ items: [{ item_name: 'z', quantity: 1, unit_price: 99000 }], payment_status: 'Lunas' }), order_status: 'Dibatalkan', payment_status: 'Lunas' };
  const s = summarize([A, B, X], [{ amount: 300000 }, { amount: 25000 }]);
  assert.equal(s.total_value, 920000);
  assert.equal(s.sales_revenue, 900000);
  assert.equal(s.trust_funds, 20000);
  assert.equal(s.expense_total, 325000);
  assert.equal(s.net_profit, 575000);
  assert.equal(s.order_count, 2);
  assert.equal(s.cancelled_count, 1);
});

const ORDER_A = {
  invoice_number: 'HB-2611001', transaction_date: '2026-11-19', customer_name: '',
  service_name: 'Penjualan Toko', shipping_fee: 0, additional_fee: 0, discount: 0, goods_total: 525000,
  total_amount: 525000, paid_amount: 525000, remaining_amount: 0, payment_status: 'Lunas',
  items: [
    { item_name: 'Kemeja batik cap (L)', quantity: 2, unit_price: 175000, subtotal: 350000 },
    { item_name: 'Selendang batik', quantity: 1, unit_price: 175000, subtotal: 175000 },
  ],
};
const SET_PAY = mergeSettings({ payment: { account_holder: 'Hans', bank: { enabled: true, name: 'BCA', account_number: '1234567890' } } });

test('format nota WhatsApp Hans Batik', () => {
  const expected = [
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🧾 *NOTA HANS BATIK*',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '📋 No. Nota  : HB-2611001',
    '📅 Tanggal   : 19 November 2026',
    '👤 Pelanggan : —',
    '🏷️ Penjualan : Penjualan Toko',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🛍️ *RINCIAN BELANJA:*',
    '',
    '1. Kemeja batik cap (L)',
    '   2x Rp 175.000 = Rp 350.000',
    '2. Selendang batik',
    '   1x Rp 175.000 = Rp 175.000',
    '   ━━━━━━━━━━━━━━━━━━━━━━',
    '   💰 *TOTAL: Rp 525.000*',
    '   ✅ Status: *LUNAS*',
    '   ━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '💳 *INFO PEMBAYARAN:*',
    '🏦 Bank BCA: 1234567890',
    '👤 a.n Hans',
    '',
    'Terima kasih telah berbelanja di Hans Batik 🙏',
  ].join('\n');
  assert.equal(buildNotaText(ORDER_A, SET_PAY), expected);
  assert.doesNotMatch(buildNotaText(ORDER_A, DEFAULT_SETTINGS), /INFO PEMBAYARAN/, 'bawaan: belum ada rekening');
});

test('nota WA: ongkir, diskon, DP, pengiriman', () => {
  const txt = buildNotaText({
    ...ORDER_A, customer_name: 'Ani', goods_total: 525000, shipping_fee: 20000, additional_fee: 5000, discount: 2000,
    total_amount: 548000, paid_amount: 200000, remaining_amount: 348000, payment_status: 'DP',
    shipping_address: 'Jl. Merdeka 1', courier: 'JNE', tracking_number: 'JNE123',
  }, SET_PAY);
  assert.match(txt, /👤 Pelanggan : Ani/);
  assert.match(txt, /Subtotal barang = Rp 525\.000/);
  assert.match(txt, /🚚 Ongkos kirim = Rp 20\.000/);
  assert.match(txt, /🏷️ Diskon = -Rp 2\.000/);
  assert.match(txt, /Sisa bayar : Rp 348\.000/);
  assert.match(txt, /🔢 Resi {3}: JNE123/);
  assert.doesNotMatch(txt, /undefined|NaN/);
});

test('rekap kas harian: pemasukan = penjualan Selesai', () => {
  const txt = buildRekapText({
    date: '2026-10-26',
    openingBalance: 404000,
    orders: [
      { invoice_number: 'HB-2610001', customer_name: 'Bu Ugi', order_status: 'Selesai', total_amount: 365000, sales_revenue: 350000 },
      { invoice_number: 'HB-2610002', customer_name: 'Pak Batal', order_status: 'Dibatalkan', sales_revenue: 20000 },
      { invoice_number: 'HB-2610003', customer_name: 'Belum Selesai', order_status: 'Dikirim', sales_revenue: 10000 },
    ],
    expenses: [
      { category_name: 'Kemasan', description: '', amount: 10000 },
      { category_name: 'Pembelian kain / bahan', description: 'Kain mori', amount: 300000 },
    ],
  });
  assert.equal(txt, [
    'REKAP KAS HARIAN',
    'Senin, 26 Oktober 2026',
    '',
    'Saldo Awal: Rp 404.000',
    '',
    'Pemasukan:',
    '- Bu Ugi: Rp 350.000',
    'Total Pemasukan: Rp 350.000',
    '',
    'Pengeluaran:',
    '- Kemasan: Rp 10.000',
    '- Kain mori: Rp 300.000',
    'Total Pengeluaran: Rp 310.000',
    '',
    'Saldo Akhir: Rp 444.000',
  ].join('\n'));
  const kosong = buildRekapText({ date: '2026-11-20', openingBalance: 50000 });
  assert.match(kosong, /Pemasukan:\n- Tidak ada\nTotal Pemasukan: Rp 0/);
});

test('terbilang Rupiah', () => {
  assert.equal(terbilang(0), 'nol');
  assert.equal(terbilang(11), 'sebelas');
  assert.equal(terbilang(115), 'seratus lima belas');
  assert.equal(terbilang(1500), 'seribu lima ratus');
  assert.equal(terbilang(845000), 'delapan ratus empat puluh lima ribu');
  assert.equal(terbilang(1250000), 'satu juta dua ratus lima puluh ribu');
  assert.equal(terbilang(2001001), 'dua juta seribu satu');
});

test('nota PDF berkop: teks aman, nama file, isi dokumen', () => {
  assert.equal(pdfSafe('Terima kasih 🙏✨ — “Hans”'), 'Terima kasih - "Hans"');
  assert.equal(notaFileName({ invoice_number: 'HB-2611001' }), 'Nota-HB-2611001.pdf');
  const JsPDF = loadJsPDFNode();
  const logo = 'data:image/png;base64,' + readFileSync(new URL('../www/icons/logo-kop.png', import.meta.url)).toString('base64');
  const settings = mergeSettings({
    business: { whatsapp: '081234567890' },
    letterhead: { address: 'Jl. Batik No. 1, Banyumas', email: 'toko@contoh.id', signer: 'Hans' },
    payment: { account_holder: 'Hans', bank: { enabled: true, name: 'BCA', account_number: '1234567890' } },
  });
  for (const paper of ['A5', 'A4']) {
    const order = { ...ORDER_A, customer_name: 'Ibu Sari', courier: 'JNE REG', tracking_number: 'JNE123', payment_method: 'Tunai' };
    const doc = buildNotaPDF(JsPDF, order, mergeSettings({ ...settings, letterhead: { ...settings.letterhead, paper } }), { logo, compress: false });
    const w = doc.internal.pageSize.getWidth();
    assert.equal(Math.round(w), paper === 'A5' ? 148 : 210, 'ukuran kertas ' + paper);
    assert.equal(doc.getNumberOfPages(), 1, 'nota pendek muat 1 halaman ' + paper);
    const raw = doc.output();
    assert.ok(raw.startsWith('%PDF-'), 'file PDF valid');
    for (const t of ['HANS BATIK', 'NOTA PENJUALAN', 'HB-2611001', 'Ibu Sari', 'Jl. Batik No. 1, Banyumas',
      'Kemeja batik cap \\(L\\)', 'Rp 525.000', 'LUNAS', 'lima ratus dua puluh lima ribu rupiah', 'Bank BCA: 1234567890',
      'No. resi: JNE123', 'Hormat kami,']) {
      assert.ok(raw.includes(t), `PDF memuat "${t}"`);
    }
    assert.ok(/\/Subtype \/Image/.test(raw), 'logo kop tertanam');
  }
  // Banyak barang → halaman bertambah, tidak error.
  const many = { ...ORDER_A, items: Array.from({ length: 40 }, (_, i) => ({ item_name: `Batik motif ${i + 1}`, quantity: 1, unit_price: 100000, subtotal: 100000 })) };
  const doc = buildNotaPDF(JsPDF, many, settings, { compress: false });
  assert.ok(doc.getNumberOfPages() >= 2, 'nota panjang lanjut ke halaman berikutnya');
  assert.ok(doc.output().includes('Hal. 2/'), 'nomor halaman');
});

test('link WhatsApp & CSV', () => {
  assert.equal(whatsappUrl('a b', '628123'), 'https://wa.me/628123?text=a%20b');
  const csv = toCSV([['Nama', 'Total'], ['Budi, "Pak"', 91000]]);
  assert.equal(csv, '﻿Nama,Total\r\n"Budi, ""Pak""",91000');
});
