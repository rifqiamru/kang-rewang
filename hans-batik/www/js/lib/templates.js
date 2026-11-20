// Teks nota & rekap untuk WhatsApp. Modul murni (bisa diuji di Node).
import { rupiah, formatDateLong, formatDateFull, formatQuantity } from './format.js';

export const LINE = '━━━━━━━━━━━━━━━━━━━━━━';

export const DEFAULT_SETTINGS = {
  business: {
    name: 'HANS BATIK',
    tagline: 'Batik Tulis & Batik Cap',
    whatsapp: '',
    owner_name: '',
    nota_footer: 'Terima kasih telah berbelanja di Hans Batik 🙏',
  },
  // Kop nota PDF
  letterhead: {
    address: '',
    phone: '',
    email: '',
    website: '',
    logo: '',          // data URL PNG/JPEG (diunggah di Pengaturan); kosong = logo bawaan
    paper: 'A5',       // 'A4' | 'A5'
    signer: '',        // nama di kolom tanda tangan
    note: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian.',
  },
  payment: {
    account_holder: '',
    bank: { enabled: false, name: '', account_number: '' },
    dana: { enabled: false, number: '' },
    qris: { enabled: false, info: '' },
  },
  invoice: { prefix: 'HB', digits: 3 },
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
  const items = order.items || [];
  const L = [];

  L.push(LINE);
  L.push(`🧾 *NOTA ${String(biz.name || 'HANS BATIK').toUpperCase()}*`);
  L.push(LINE);
  L.push(`📋 No. Nota  : ${order.invoice_number || '-'}`);
  L.push(`📅 Tanggal   : ${formatDateLong(order.transaction_date)}`);
  L.push(`👤 Pelanggan : ${String(order.customer_name || '').trim() || '—'}`);
  if (order.service_name) L.push(`🏷️ Penjualan : ${order.service_name}`);
  L.push(LINE);
  L.push('🛍️ *RINCIAN BELANJA:*');
  L.push('');

  const desc = String(order.description || '').trim();
  if (desc) { L.push(`📝 ${desc}`); L.push(''); }
  if (items.length) {
    items.forEach((it, i) => {
      L.push(`${i + 1}. ${it.item_name}`);
      L.push(`   ${formatQuantity(it.quantity)}x ${R(it.unit_price)} = ${R(it.subtotal)}`);
    });
  } else {
    L.push(`1. ${desc || order.service_name || 'Pembelian batik'}`);
  }

  L.push(`   ${LINE}`);
  if (Number(order.shipping_fee) > 0 || Number(order.additional_fee) > 0 || Number(order.discount) > 0) {
    L.push(`   Subtotal barang = ${R(order.goods_total ?? items.reduce((t, it) => t + (Number(it.subtotal) || 0), 0))}`);
  }
  if (Number(order.shipping_fee) > 0) L.push(`   🚚 Ongkos kirim = ${R(order.shipping_fee)}`);
  if (Number(order.additional_fee) > 0) L.push(`   ➕ Biaya tambahan = ${R(order.additional_fee)}`);
  if (Number(order.discount) > 0) L.push(`   🏷️ Diskon = -${R(order.discount)}`);
  L.push(`   💰 *TOTAL: ${R(order.total_amount)}*`);
  if (order.payment_status === 'DP') {
    L.push(`   ✅ Sudah dibayar (DP) : ${R(order.paid_amount)}`);
    L.push(`   ⏳ *Sisa bayar : ${R(order.remaining_amount)}*`);
  } else if (order.payment_status === 'Lunas') {
    L.push('   ✅ Status: *LUNAS*');
  }
  L.push(`   ${LINE}`);

  const ship = [];
  if (order.shipping_address) ship.push(`📍 Alamat : ${order.shipping_address}`);
  if (order.courier) ship.push(`🚚 Kurir  : ${order.courier}`);
  if (order.tracking_number) ship.push(`🔢 Resi   : ${order.tracking_number}`);
  if (ship.length) { L.push(''); L.push('📦 *PENGIRIMAN:*'); L.push(...ship); }

  const payLines = paymentLines(settings);
  if (payLines.length) {
    L.push('');
    L.push('💳 *INFO PEMBAYARAN:*');
    L.push(...payLines.map((p) => `${p.emoji} ${p.label.padEnd(8)}: ${p.value}`));
    const holder = settings.payment?.account_holder;
    if (holder) L.push(`👤 a.n ${holder}`);
  }

  L.push('');
  L.push(biz.nota_footer || 'Terima kasih telah berbelanja 🙏');
  return L.join('\n');
}

/** Metode pembayaran yang aktif di Pengaturan (dipakai nota WA & PDF). */
export function paymentLines(settings = DEFAULT_SETTINGS) {
  const pay = settings.payment || {};
  const out = [];
  if (pay.bank?.enabled && pay.bank.account_number) {
    out.push({ emoji: '🏦', label: `Bank ${pay.bank.name || ''}`.trim(), value: pay.bank.account_number });
  }
  if (pay.dana?.enabled && pay.dana.number) out.push({ emoji: '💙', label: 'Dana', value: pay.dana.number });
  if (pay.qris?.enabled && pay.qris.info) out.push({ emoji: '🔳', label: 'QRIS', value: pay.qris.info });
  return out;
}

/**
 * Rekap kas harian untuk WhatsApp. Pemasukan = PENDAPATAN PENJUALAN order
 * berstatus Selesai; ongkos kirim titipan tidak dihitung.
 * @param {object} p
 *   date: "YYYY-MM-DD"
 *   orders: order pada tanggal tsb. (yang belum Selesai/dibatalkan disaring)
 *   expenses: [{ category_name, description, amount }]
 *   openingBalance: saldo akhir hari sebelumnya (get_balance(tanggal − 1))
 */
export function rekapKas({ orders = [], expenses = [], openingBalance = 0 }) {
  const income = orders
    .filter((o) => o.order_status === 'Selesai' && Number(o.sales_revenue) !== 0)
    .map((o) => ({
      label: String(o.customer_name || '').trim() || o.service_name || o.invoice_number,
      amount: Number(o.sales_revenue) || 0,
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
