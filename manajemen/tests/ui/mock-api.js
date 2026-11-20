// API tiruan (in-memory) untuk uji antarmuka dengan Playwright.
// Disajikan menggantikan /js/api.js. Aturan hitung sama dengan database
// (memakai lib/calc.js), tetapi ini HANYA untuk pengujian.
import { mergeSettings } from './lib/templates.js';
import { computeOrder, summarize, itemSubtotal } from './lib/calc.js';

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const todayJ = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

const db = {
  settings: {},
  service_categories: ['Titip Belanja', 'Titip Makanan', 'Antar Jemput', 'Pengiriman Barang', 'Jastip', 'Transportasi', 'Lainnya']
    .map((name, i) => ({ id: uid(), name, is_active: true, sort_order: i + 1 })),
  expense_categories: ['Bensin', 'Parkir', 'Tol', 'Konsumsi', 'Perawatan kendaraan', 'Pembelian perlengkapan', 'Biaya komunikasi/internet', 'Biaya operasional lainnya']
    .map((name, i) => ({ id: uid(), name, is_active: true, sort_order: i + 1 })),
  orders: [], items: [], expenses: [], counters: {},
};
window.__db = db;
window.__calls = { saveOrder: 0 };
let session = null;
const listeners = [];

export class ApiError extends Error {
  constructor(message, { offline = false } = {}) { super(message); this.offline = offline; }
}
export const friendlyError = (e) => e;
const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms));
async function net() {
  await delay();
  if (window.__mockOffline) throw new ApiError('Tidak ada koneksi internet. Data BELUM tersimpan ke server — periksa koneksi lalu coba lagi.', { offline: true });
}

export const isConfigured = () => true;
export const init = () => ({});
export async function getSession() { return session; }
export function onAuthChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; }
export async function signIn(email, password) {
  await net();
  if (password !== 'rahasia123') throw new ApiError('Email atau password salah.');
  session = { user: { id: 'owner', email } };
  return session;
}
export async function signOut() { session = null; }
export async function resetPassword() { await net(); }
export async function updatePassword() { await net(); }
export async function getProfile() { return { user: session?.user, profile: { id: 'owner', full_name: 'Rifqi Amrullah', is_owner: true } }; }
export async function updateProfileName() { await net(); }

export async function loadSettings() { await net(); return mergeSettings(db.settings); }
export async function saveSetting(k, v) { await net(); db.settings[k] = v; }
export async function listCategories(t) { await net(); return [...db[t]].sort((a, b) => a.sort_order - b.sort_order); }
export async function saveCategory(t, row) {
  await net();
  if (row.id) { Object.assign(db[t].find((c) => c.id === row.id), row); return row; }
  const r = { id: uid(), sort_order: 50, ...row }; db[t].push(r); return r;
}

const svcName = (id) => db.service_categories.find((s) => s.id === id)?.name ?? null;
function full(o) {
  return { ...o, service_name: svcName(o.service_category_id), items: db.items.filter((i) => i.order_id === o.id).sort((a, b) => a.sort_order - b.sort_order) };
}
function recompute(o) {
  const items = db.items.filter((i) => i.order_id === o.id);
  const c = computeOrder({ ...o, items });
  if (c.errors.length && !c.errors[0].startsWith('Nama')) throw new ApiError(c.errors[0]);
  Object.assign(o, { goods_total: c.goods_total, total_amount: c.total_amount, service_revenue: c.service_revenue,
    trust_amount: c.trust_amount, paid_amount: c.paid_amount, remaining_amount: c.remaining_amount, updated_at: now() });
}

export async function saveOrder(p) {
  window.__calls.saveOrder++;
  await net();
  await delay(250);
  if (!p.id && p.client_request_id) {
    const ex = db.orders.find((o) => o.client_request_id === p.client_request_id);
    if (ex) return { ...full(ex), _duplicate: true };
  }
  const fields = ['transaction_date', 'customer_name', 'customer_phone', 'service_category_id', 'description', 'pickup_location',
    'destination', 'distance', 'service_fee', 'additional_fee', 'additional_fee_is_revenue', 'discount', 'paid_amount',
    'payment_method', 'payment_status', 'order_status', 'notes'];
  let o;
  if (p.id) {
    o = db.orders.find((x) => x.id === p.id);
    for (const f of fields) o[f] = p[f];
    db.items = db.items.filter((i) => i.order_id !== o.id);
  } else {
    const cfg = mergeSettings(db.settings).invoice;
    const period = p.transaction_date.slice(2, 4) + p.transaction_date.slice(5, 7);
    const k = cfg.prefix + period;
    db.counters[k] = (db.counters[k] || 0) + 1;
    o = { id: uid(), client_request_id: p.client_request_id, created_at: now(),
      invoice_number: `${cfg.prefix}-${period}${String(db.counters[k]).padStart(cfg.digits, '0')}` };
    for (const f of fields) o[f] = p[f];
    db.orders.push(o);
  }
  p.items.forEach((it, i) => db.items.push({ id: uid(), order_id: o.id, item_name: it.item_name, quantity: it.quantity,
    unit_price: it.unit_price, subtotal: itemSubtotal(it.quantity, it.unit_price), sort_order: i + 1 }));
  recompute(o);
  return full(o);
}
export async function getOrder(id) { await net(); const o = db.orders.find((x) => x.id === id); return o ? full(o) : null; }
export async function listOrders({ q, start, end, service, payment, status, limit = 30, offset = 0 } = {}) {
  await net();
  let r = db.orders.map(full);
  if (start) r = r.filter((o) => o.transaction_date >= start);
  if (end) r = r.filter((o) => o.transaction_date <= end);
  if (service) r = r.filter((o) => o.service_category_id === service);
  if (payment === 'unpaid') r = r.filter((o) => o.payment_status !== 'Lunas' && o.order_status !== 'Dibatalkan');
  else if (payment) r = r.filter((o) => o.payment_status === payment);
  if (status === 'open') r = r.filter((o) => !['Selesai', 'Dibatalkan'].includes(o.order_status));
  else if (status) r = r.filter((o) => o.order_status === status);
  if (q) { const t = q.toLowerCase(); r = r.filter((o) => [o.invoice_number, o.customer_name, o.customer_phone].some((v) => String(v).toLowerCase().includes(t))); }
  r.sort((a, b) => (b.transaction_date + b.created_at).localeCompare(a.transaction_date + a.created_at));
  return { rows: r.slice(offset, offset + limit), count: r.length };
}
export async function ordersForRange(s, e) { await net(); return db.orders.filter((o) => o.transaction_date >= s && o.transaction_date <= e).map(full); }
export async function updateOrder(id, patch) { await net(); const o = db.orders.find((x) => x.id === id); Object.assign(o, patch); recompute(o); return { id }; }
export async function deleteOrder(id) { await net(); db.orders = db.orders.filter((o) => o.id !== id); db.items = db.items.filter((i) => i.order_id !== id); }

const expFull = (e) => ({ ...e, category_name: db.expense_categories.find((c) => c.id === e.category_id)?.name ?? '' });
export async function listExpenses({ q, start, end, category, limit = 50, offset = 0 } = {}) {
  await net();
  let r = db.expenses.map(expFull);
  if (start) r = r.filter((e) => e.expense_date >= start);
  if (end) r = r.filter((e) => e.expense_date <= end);
  if (category) r = r.filter((e) => e.category_id === category);
  if (q) r = r.filter((e) => (e.description + e.notes).toLowerCase().includes(q.toLowerCase()));
  r.sort((a, b) => (b.expense_date + b.created_at).localeCompare(a.expense_date + a.created_at));
  return { rows: r.slice(offset, offset + limit), count: r.length };
}
export async function expensesForRange(s, e) { await net(); return db.expenses.filter((x) => x.expense_date >= s && x.expense_date <= e).map(expFull); }
export async function saveExpense(row) {
  await net();
  if (row.id) { Object.assign(db.expenses.find((e) => e.id === row.id), row); return row; }
  const r = { id: uid(), created_at: now(), ...row }; db.expenses.push(r); return r;
}
export async function deleteExpense(id) { await net(); db.expenses = db.expenses.filter((e) => e.id !== id); }

function rangeData(s, e) {
  return [db.orders.filter((o) => o.transaction_date >= s && o.transaction_date <= e),
    db.expenses.filter((x) => x.expense_date >= s && x.expense_date <= e)];
}
export async function summary(s, e) {
  await net();
  const [o, x] = rangeData(s, e);
  const base = summarize(o, x);
  const byCat = {};
  for (const ex of x.map(expFull)) { byCat[ex.category_name] ??= { category: ex.category_name, total: 0, count: 0 }; byCat[ex.category_name].total += ex.amount; byCat[ex.category_name].count++; }
  const bySvc = {};
  for (const od of o.filter((y) => y.order_status !== 'Dibatalkan')) {
    const n = svcName(od.service_category_id) || 'Tanpa kategori';
    bySvc[n] ??= { service: n, count: 0, revenue: 0 }; bySvc[n].count++;
    if (od.order_status === 'Selesai') bySvc[n].revenue += od.service_revenue;
  }
  return { ...base, start: s, end: e, expenses_by_category: Object.values(byCat), by_service: Object.values(bySvc) };
}
export async function dailySeries(s, e) {
  await net();
  const out = [];
  for (let d = new Date(s + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const [o, x] = rangeData(day, day);
    const sm = summarize(o, x);
    out.push({ day, order_count: sm.order_count, cash_in: sm.cash_in, service_revenue: sm.service_revenue, expense_total: sm.expense_total, net_profit: sm.net_profit });
  }
  return out;
}
export async function outstanding() {
  await net();
  const a = db.orders.filter((o) => o.order_status !== 'Dibatalkan');
  return { open_count: a.filter((o) => o.order_status !== 'Selesai').length, unpaid_count: a.filter((o) => o.payment_status !== 'Lunas').length,
    receivables: a.reduce((t, o) => t + o.remaining_amount, 0) };
}
export async function recentActivity(limit = 6) {
  await net();
  return [...db.orders.map((o) => ({ kind: 'order', ...full(o) })), ...db.expenses.map((e) => ({ kind: 'expense', ...expFull(e) }))]
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit + 2);
}
// Data contoh beberapa hari ke belakang untuk grafik (dipanggil oleh skrip uji)
window.__seedHistory = () => {
  const t = todayJ();
  for (let i = 1; i <= 9; i++) {
    const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    if (day.slice(0, 7) !== t.slice(0, 7)) continue;
    const fee = 15000 + ((i * 7919) % 5) * 10000;
    const o = { id: uid(), invoice_number: `KR-H${i}`, client_request_id: uid(), created_at: day + 'T03:00:00Z', transaction_date: day,
      customer_name: 'Riwayat ' + i, customer_phone: '', service_category_id: db.service_categories[i % 6].id, description: '', pickup_location: '',
      destination: '', distance: null, service_fee: fee, additional_fee: 0, additional_fee_is_revenue: true, discount: 0,
      paid_amount: 0, payment_method: 'Tunai', payment_status: 'Lunas', order_status: 'Selesai', notes: '' };
    db.orders.push(o); recompute(o);
    db.expenses.push({ id: uid(), created_at: day + 'T04:00:00Z', expense_date: day, category_id: db.expense_categories[i % 3].id,
      description: '', amount: i === 4 ? 60000 : 10000 + (i % 3) * 5000, payment_method: 'Tunai', notes: '' });
  }
};
