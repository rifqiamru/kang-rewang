// Perhitungan nota di sisi browser untuk PRATINJAU langsung saat mengetik.
// Sumber kebenaran tetap di database (trigger orders_compute & order_items_compute
// di supabase/schema.sql). Rumus di sini harus identik.

export const PAYMENT_STATUSES = ['Belum Bayar', 'DP', 'Lunas'];
export const ORDER_STATUSES = ['Pesanan', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];
export const PAYMENT_METHODS = ['Tunai', 'Transfer Bank', 'Dana', 'QRIS', 'Lainnya'];

export function itemSubtotal(quantity, unitPrice) {
  const q = Math.round((Number(quantity) || 0) * 100) / 100;
  return Math.round(q * (Number(unitPrice) || 0));
}

/**
 * @param {object} o  { items:[{quantity,unit_price}], shipping_fee, additional_fee,
 *                     additional_fee_is_revenue, discount, payment_status, paid_amount }
 * @returns {{goods_total,total_amount,sales_revenue,trust_amount,paid_amount,remaining_amount,errors:string[]}}
 */
export function computeOrder(o) {
  const errors = [];
  const items = Array.isArray(o.items) ? o.items : [];
  const goods_total = items.reduce((s, it) => s + itemSubtotal(it.quantity, it.unit_price), 0);
  const shipping_fee = int(o.shipping_fee);
  const additional_fee = int(o.additional_fee);
  const discount = int(o.discount);
  const addlRevenue = o.additional_fee_is_revenue !== false;

  const total_amount = goods_total + shipping_fee + additional_fee - discount;
  if (total_amount < 0) errors.push('Diskon melebihi total tagihan.');

  // Toko batik: harga barang = pendapatan penjualan; ongkos kirim diteruskan
  // ke ekspedisi sehingga dicatat sebagai titipan, bukan pendapatan.
  const sales_revenue = goods_total + (addlRevenue ? additional_fee : 0) - discount;
  const trust_amount = shipping_fee + (addlRevenue ? 0 : additional_fee);

  let paid_amount = int(o.paid_amount);
  const status = o.payment_status || 'Belum Bayar';
  if (status === 'Lunas') paid_amount = Math.max(0, total_amount);
  else if (status === 'Belum Bayar') paid_amount = 0;
  else if (status === 'DP') {
    if (paid_amount <= 0) errors.push('Nominal DP harus lebih dari Rp0.');
    else if (paid_amount >= total_amount) errors.push('DP harus lebih kecil dari total. Pilih Lunas jika sudah dibayar penuh.');
  }
  const remaining_amount = Math.max(0, total_amount - paid_amount);

  items.forEach((it, i) => {
    if (!String(it.item_name ?? '').trim()) errors.push(`Nama barang baris ${i + 1} belum diisi.`);
    if (!(Number(it.quantity) > 0)) errors.push(`Jumlah barang baris ${i + 1} harus lebih dari 0.`);
  });

  return { goods_total, total_amount, sales_revenue, trust_amount, paid_amount, remaining_amount, errors };
}

function int(v) {
  const n = Math.round(Number(v) || 0);
  return n < 0 ? 0 : n;
}

/**
 * Ringkasan keuangan dari daftar order & pengeluaran (dipakai uji & mode demo).
 * Aturan sama dengan get_financial_summary di database.
 */
export function summarize(orders, expenses) {
  const active = orders.filter((o) => o.order_status !== 'Dibatalkan');
  const done = orders.filter((o) => o.order_status === 'Selesai');
  const open = active.filter((o) => o.order_status !== 'Selesai');
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const sales_revenue = sum(done, 'sales_revenue');
  const expense_total = sum(expenses, 'amount');
  return {
    order_count: active.length,
    completed_count: done.length,
    open_count: open.length,
    cancelled_count: orders.length - active.length,
    unpaid_count: active.filter((o) => o.payment_status !== 'Lunas').length,
    total_value: sum(active, 'total_amount'),
    cash_in: sum(active, 'paid_amount'),
    receivables: sum(active, 'remaining_amount'),
    trust_funds: sum(active, 'trust_amount'),
    sales_revenue,
    pending_revenue: sum(open, 'sales_revenue'),
    expense_count: expenses.length,
    expense_total,
    net_profit: sales_revenue - expense_total,
  };
}
