// Teks nota & rekap untuk WhatsApp. Modul murni (bisa diuji di Node).
import { rupiah, formatDateLong, formatQuantity } from './format.js';

export const LINE = '━━━━━━━━━━━━━━━━━━━━━━';

export const DEFAULT_SETTINGS = {
  business: {
    name: 'KANG REWANG',
    tagline: 'Rewang Apa Bae, Ora Rewel',
    whatsapp: '081292923132',
    owner_name: 'Rifqi Amrullah',
    nota_footer: 'Terima kasih sudah pakai jasa Kang Rewang 🙏✨',
  },
  payment: {
    account_holder: 'Rifqi Amrullah',
    bank: { enabled: true, name: 'BRI', account_number: '137701013167504' },
    dana: { enabled: true, number: '081292923132' },
    qris: { enabled: true, info: 'Cek Katalog' },
  },
  invoice: { prefix: 'KR', digits: 3 },
  display: { show_pending_revenue: true },
  balance: { opening_amount: 0, start_date: null },
};

/** Gabungkan pengaturan dari database dengan nilai bawaan. */
export function mergeSettings(rows) {
  const s = structuredCloneSafe(DEFAULT_SETTINGS);
  for (const [key, val] of Object.entries(rows || {})) {
    if (val && typeof val === 'object' && s[key]) {
      for (const [k, v] of Object.entries(val)) {
        s[key][k] = v && typeof v === 'object' && !Array.isArray(v) && s[key][k] && typeof s[key][k] === 'object'
          ? { ...s[key][k], ...v } : v;
      }
    } else if (val !== undefined) {
      s[key] = val;
    }
  }
  return s;
}
function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

const R = (n) => rupiah(n, { space: true });

/**
 * Nota pelanggan.
 * @param {object} order  baris orders + { items:[], service_name }
 * @param {object} settings  hasil mergeSettings
 */
export function buildNotaText(order, settings = DEFAULT_SETTINGS) {
  const biz = settings.business || {};
  const pay = settings.payment || {};
  const items = order.items || [];
  const L = [];

  L.push(LINE);
  L.push(`🛵 *NOTA ${String(biz.name || 'KANG REWANG').toUpperCase()}*`);
  L.push(LINE);
  L.push(`📋 No. Nota  : ${order.invoice_number || '-'}`);
  L.push(`📅 Tanggal   : ${formatDateLong(order.transaction_date)}`);
  L.push(`👤 Pelanggan : ${String(order.customer_name || '').trim() || '—'}`);
  L.push(`🛠️ Layanan   : ${order.service_name || '—'}`);
  L.push(LINE);
  L.push('🛍️ *RINCIAN:*');
  L.push('');

  const route = [];
  if (order.pickup_location) route.push(`📍 Jemput : ${order.pickup_location}`);
  if (order.destination) route.push(`🏁 Tujuan : ${order.destination}`);
  if (order.distance !== null && order.distance !== undefined && order.distance !== '' && Number(order.distance) > 0) {
    route.push(`📏 Jarak  : ${formatQuantity(order.distance)} km`);
  }
  if (route.length) { L.push(...route); L.push(''); }

  const desc = String(order.description || '').trim();
  if (items.length) {
    if (desc) { L.push(`📝 ${desc}`); L.push(''); }
    items.forEach((it, i) => {
      L.push(`${i + 1}. ${it.item_name}`);
      L.push(`   ${formatQuantity(it.quantity)}x ${R(it.unit_price)} = ${R(it.subtotal)}`);
    });
  } else {
    // Layanan tanpa rincian barang (antar jemput, kirim barang, dll.)
    L.push(`1. ${desc || order.service_name || 'Jasa Kang Rewang'}`);
  }

  if (Number(order.service_fee) > 0) L.push(`   🛵 Ongkos jasa  = ${R(order.service_fee)}`);
  if (Number(order.additional_fee) > 0) L.push(`   ➕ Biaya tambahan = ${R(order.additional_fee)}`);
  if (Number(order.discount) > 0) L.push(`   🏷️ Diskon = -${R(order.discount)}`);
  L.push(`   ${LINE}`);
  L.push(`   💰 *TOTAL: ${R(order.total_amount)}*`);
  if (order.payment_status === 'DP') {
    L.push(`   ✅ Sudah dibayar (DP) : ${R(order.paid_amount)}`);
    L.push(`   ⏳ *Sisa bayar : ${R(order.remaining_amount)}*`);
  } else if (order.payment_status === 'Lunas') {
    L.push('   ✅ Status: *LUNAS*');
  }
  L.push(`   ${LINE}`);

  const payLines = [];
  if (pay.bank?.enabled && pay.bank.account_number) {
    payLines.push(`🏦 Bank ${pay.bank.name || ''} : ${pay.bank.account_number}`.replace('Bank  :', 'Bank :'));
  }
  if (pay.dana?.enabled && pay.dana.number) payLines.push(`💙 Dana     : ${pay.dana.number}`);
  if (pay.qris?.enabled && pay.qris.info) payLines.push(`🔳 QRIS     : ${pay.qris.info}`);
  // Metode yang dinonaktifkan di Pengaturan tidak ditampilkan.
  if (payLines.length) {
    L.push('');
    L.push('💳 *INFO PEMBAYARAN:*');
    L.push(...payLines);
    if (pay.account_holder) L.push(`👤 a.n ${pay.account_holder}`);
  }

  L.push('');
  L.push(biz.nota_footer || 'Terima kasih sudah pakai jasa Kang Rewang 🙏✨');
  return L.join('\n');
}

/**
 * Rekap harian untuk grup WhatsApp.
 * @param {object} p { date, orders, expenses, summary, settings }
 *   orders: daftar order hari itu (termasuk yang dibatalkan; akan disaring)
 *   expenses: [{ category_name, description, amount }]
 *   summary: hasil get_financial_summary untuk tanggal tsb.
 *   balance: hasil get_balance(tanggal) — opsional, menambah baris saldo.
 */
export function buildRekapText({ date, orders = [], expenses = [], summary, balance = null, settings = DEFAULT_SETTINGS }) {
  const biz = settings.business || {};
  const active = orders.filter((o) => o.order_status !== 'Dibatalkan');
  const cancelled = orders.length - active.length;
  const L = [];

  L.push(LINE);
  L.push(`📊 *REKAP HARIAN ${String(biz.name || 'KANG REWANG').toUpperCase()}*`);
  L.push(LINE);
  L.push(`📅 Tanggal: ${formatDateLong(date)}`);
  L.push('');
  L.push('🛵 *DAFTAR TRANSAKSI*');
  L.push('');
  if (!active.length) {
    L.push('Belum ada transaksi.');
  } else {
    active.forEach((o, i) => {
      if (i > 0) L.push('');
      L.push(`${i + 1}. ${o.invoice_number}`);
      L.push(`   Pelanggan: ${String(o.customer_name || '').trim() || '—'}`);
      L.push(`   Layanan: ${o.service_name || '—'}`);
      L.push(`   Total: ${rupiah(o.total_amount)}`);
      const st = o.order_status === 'Selesai' ? o.payment_status : `${o.payment_status} · ${o.order_status}`;
      L.push(`   Status: ${st}`);
    });
  }
  if (cancelled > 0) {
    L.push('');
    L.push(`(${cancelled} transaksi dibatalkan, tidak dihitung)`);
  }

  L.push('');
  L.push(LINE);
  L.push('💰 *RINGKASAN TRANSAKSI*');
  L.push('');
  L.push(`Jumlah order: ${summary.order_count}`);
  L.push(`Uang masuk pelanggan: ${rupiah(summary.cash_in)}`);
  L.push(`Pendapatan jasa: ${rupiah(summary.service_revenue)}`);
  if (Number(summary.trust_funds) > 0) L.push(`Dana titipan belanja: ${rupiah(summary.trust_funds)}`);
  if (Number(summary.receivables) > 0) L.push(`Belum dibayar (piutang): ${rupiah(summary.receivables)}`);
  if (Number(summary.pending_revenue) > 0) L.push(`Jasa order belum selesai: ${rupiah(summary.pending_revenue)}`);

  L.push('');
  L.push(LINE);
  L.push('⛽ *PENGELUARAN OPERASIONAL*');
  L.push('');
  if (!expenses.length) {
    L.push('Tidak ada pengeluaran.');
  } else {
    expenses.forEach((e, i) => L.push(`${i + 1}. ${e.category_name || 'Lainnya'}: ${rupiah(e.amount)}`));
  }
  L.push('');
  L.push(`Total pengeluaran: ${rupiah(summary.expense_total)}`);

  L.push('');
  L.push(LINE);
  L.push('📈 *RINGKASAN KEUANGAN*');
  L.push('');
  L.push(`Pendapatan jasa: ${rupiah(summary.service_revenue)}`);
  L.push(`Pengeluaran: ${rupiah(summary.expense_total)}`);
  L.push('');
  L.push(`*KEUNTUNGAN BERSIH: ${rupiah(summary.net_profit)}*`);
  L.push(LINE);
  if (balance) {
    L.push('');
    L.push('💼 *SALDO USAHA*');
    L.push('');
    L.push(`Saldo akhir hari: ${rupiah(balance.balance)}`);
    L.push(LINE);
  }
  L.push('');
  L.push('Terima kasih.');
  L.push(String(biz.name || 'KANG REWANG').toUpperCase());
  L.push(`${biz.tagline || 'Rewang Apa Bae, Ora Rewel'}.`.replace(/\.\.$/, '.'));
  return L.join('\n');
}

/** Link WhatsApp siap kirim. phone kosong → pengguna memilih kontak sendiri. */
export function whatsappUrl(text, phone = '') {
  const num = String(phone || '').replace(/^\+/, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
