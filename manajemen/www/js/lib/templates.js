// Teks nota & rekap untuk WhatsApp. Modul murni (bisa diuji di Node).
import { rupiah, formatDateLong, formatDateFull, formatQuantity } from './format.js';

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
 * Rekap kas harian untuk WhatsApp. Pemasukan = ONGKOS JASA saja (pendapatan
 * jasa order berstatus Selesai); uang belanja titipan tidak dihitung.
 * @param {object} p
 *   date: "YYYY-MM-DD"
 *   orders: order pada tanggal tsb. (yang belum Selesai/dibatalkan disaring)
 *   expenses: [{ category_name, description, amount }]
 *   openingBalance: saldo akhir hari sebelumnya (get_balance(tanggal − 1))
 */
export function rekapKas({ orders = [], expenses = [], openingBalance = 0 }) {
  const income = orders
    .filter((o) => o.order_status === 'Selesai' && Number(o.service_revenue) !== 0)
    .map((o) => ({
      label: String(o.customer_name || '').trim() || o.service_name || o.invoice_number,
      amount: Number(o.service_revenue) || 0,
    }));
  const outgoing = expenses.map((e) => ({
    label: String(e.description || '').trim() || e.category_name || 'Pengeluaran',
    amount: Number(e.amount) || 0,
  }));
  const totalIn = income.reduce((t, x) => t + x.amount, 0);
  const totalOut = outgoing.reduce((t, x) => t + x.amount, 0);
  const opening = Number(openingBalance) || 0;
  return { income, outgoing, totalIn, totalOut, opening, closing: opening + totalIn - totalOut };
}

export function buildRekapText({ date, orders = [], expenses = [], openingBalance = 0 }) {
  const k = rekapKas({ orders, expenses, openingBalance });
  const R = (n) => rupiah(n, { space: true });
  const L = [];
  L.push('REKAP KAS HARIAN');
  L.push(formatDateFull(date));
  L.push('');
  L.push(`Saldo Awal: ${R(k.opening)}`);
  L.push('');
  L.push('Pemasukan:');
  if (k.income.length) k.income.forEach((x) => L.push(`- ${x.label}: ${R(x.amount)}`));
  else L.push('- Tidak ada');
  L.push(`Total Pemasukan: ${R(k.totalIn)}`);
  L.push('');
  L.push('Pengeluaran:');
  if (k.outgoing.length) k.outgoing.forEach((x) => L.push(`- ${x.label}: ${R(x.amount)}`));
  else L.push('- Tidak ada');
  L.push(`Total Pengeluaran: ${R(k.totalOut)}`);
  L.push('');
  L.push(`Saldo Akhir: ${R(k.closing)}`);
  return L.join('\n');
}

/** Link WhatsApp siap kirim. phone kosong → pengguna memilih kontak sendiri. */
export function whatsappUrl(text, phone = '') {
  const num = String(phone || '').replace(/^\+/, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}
