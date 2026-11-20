// Lapisan akses data Supabase. Semua halaman memakai fungsi di sini,
// sehingga satu sumber data dipakai di Dashboard, Rekap, dan Laporan.
import { mergeSettings } from './lib/templates.js';

let sb = null;

export function isConfigured() {
  const c = window.KR_CONFIG || {};
  return Boolean(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && window.supabase?.createClient);
}

// Kunci sederhana di memori untuk proses auth Supabase. Kunci bawaan
// (navigator.locks) diketahui bisa macet di aplikasi PWA Android saat
// aplikasi dibuka lagi dari latar belakang, sehingga layar loading tidak
// pernah selesai. Aplikasi ini dipakai satu orang di satu jendela.
const authLocks = new Map();
async function memoryLock(name, _acquireTimeout, fn) {
  const prev = authLocks.get(name) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  authLocks.set(name, prev.then(() => mine));
  try { await prev; } catch { /* abaikan */ }
  try {
    return await fn();
  } finally {
    release();
    if (authLocks.get(name) === mine) authLocks.delete(name);
  }
}

export function init() {
  if (sb) return sb;
  const c = window.KR_CONFIG;
  sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, lock: memoryLock },
  });
  return sb;
}

// ---------- Error ----------
export class ApiError extends Error {
  constructor(message, { offline = false, cause } = {}) {
    super(message);
    this.offline = offline;
    this.cause = cause;
  }
}

function isNetworkError(err) {
  const m = String(err?.message || err || '');
  return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout/i.test(m);
}

/** Ubah error Supabase/PostgREST menjadi pesan Bahasa Indonesia yang jelas. */
export function friendlyError(err) {
  if (err instanceof ApiError) return err;
  if (isNetworkError(err)) {
    return new ApiError('Tidak ada koneksi internet. Data BELUM tersimpan ke server — periksa koneksi lalu coba lagi.', { offline: true, cause: err });
  }
  const code = err?.code;
  let msg = err?.message || 'Terjadi kesalahan.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    msg = 'Akses ditolak. Pastikan Anda login dengan akun pemilik.';
  } else if (code === '23505') {
    msg = 'Data yang sama sudah ada.';
  } else if (code === '23503') {
    msg = 'Data ini masih dipakai oleh data lain sehingga tidak bisa dihapus. Nonaktifkan saja.';
  } else if (code === '23514') {
    msg = 'Ada isian yang tidak valid. Periksa kembali angka dan teks yang diisi.';
  } else if (code === 'PGRST301' || /JWT/i.test(msg)) {
    msg = 'Sesi login berakhir. Silakan login ulang.';
  } else if (/Invalid login credentials/i.test(msg)) {
    msg = 'Email atau password salah.';
  } else if (/Email not confirmed/i.test(msg)) {
    msg = 'Email belum dikonfirmasi. Cek kotak masuk email Anda.';
  }
  return new ApiError(msg, { cause: err });
}

async function run(promise) {
  let res;
  try {
    res = await promise;
  } catch (e) {
    throw friendlyError(e);
  }
  if (res.error) throw friendlyError(res.error);
  return res.data;
}

// ---------- Auth ----------
export async function getSession() {
  const { data } = await init().auth.getSession();
  return data.session;
}
export function onAuthChange(cb) {
  return init().auth.onAuthStateChange((event, session) => cb(event, session));
}
export async function signIn(email, password) {
  return run(init().auth.signInWithPassword({ email, password }));
}
export async function signOut() {
  await init().auth.signOut();
}
export async function resetPassword(email) {
  return run(init().auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
}
export async function updatePassword(password) {
  return run(init().auth.updateUser({ password }));
}
export async function getProfile() {
  const { data: { user } } = await init().auth.getUser();
  if (!user) return null;
  const profile = await run(init().from('profiles').select('*').eq('id', user.id).maybeSingle());
  return { user, profile };
}
export async function updateProfileName(full_name) {
  const { data: { user } } = await init().auth.getUser();
  return run(init().from('profiles').update({ full_name }).eq('id', user.id));
}

// ---------- Pengaturan ----------
export async function loadSettings() {
  const rows = await run(init().from('app_settings').select('setting_key, setting_value'));
  const obj = {};
  for (const r of rows) obj[r.setting_key] = r.setting_value;
  return mergeSettings(obj);
}
export async function saveSetting(key, value) {
  return run(init().from('app_settings')
    .upsert({ setting_key: key, setting_value: value }, { onConflict: 'setting_key' }));
}

// ---------- Kategori ----------
export async function listCategories(table) {
  return run(init().from(table).select('*').order('sort_order').order('name'));
}
export async function saveCategory(table, { id, name, is_active = true, sort_order }) {
  const row = { name: String(name).trim(), is_active };
  if (sort_order !== undefined) row.sort_order = sort_order;
  if (id) return run(init().from(table).update(row).eq('id', id).select().single());
  return run(init().from(table).insert(row).select().single());
}

// ---------- Order ----------
const ORDER_LIST_COLS = 'id, invoice_number, transaction_date, customer_name, customer_phone, service_category_id, ' +
  'goods_total, service_fee, additional_fee, discount, total_amount, paid_amount, remaining_amount, ' +
  'service_revenue, trust_amount, payment_method, payment_status, order_status, created_at, ' +
  'service_categories(name)';

function flattenOrder(o) {
  if (!o) return o;
  const { service_categories: sc, ...rest } = o;
  return { ...rest, service_name: rest.service_name ?? sc?.name ?? null };
}

/** Simpan nota baru / ubah nota. Atomik & idempoten di database. */
export async function saveOrder(payload) {
  return run(init().rpc('save_order', { p: payload }));
}
export async function getOrder(id) {
  return run(init().rpc('get_order', { p_id: id }));
}

/** Membersihkan kata kunci agar aman dipakai pada filter PostgREST. */
function cleanQuery(q) {
  return String(q || '').replace(/[,()"'\\%*:]/g, ' ').trim().slice(0, 60);
}

export async function listOrders({ q, start, end, service, payment, status, limit = 30, offset = 0 } = {}) {
  let query = init().from('orders').select(ORDER_LIST_COLS, { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (start) query = query.gte('transaction_date', start);
  if (end) query = query.lte('transaction_date', end);
  if (service) query = query.eq('service_category_id', service);
  if (payment === 'unpaid') query = query.neq('payment_status', 'Lunas').neq('order_status', 'Dibatalkan');
  else if (payment) query = query.eq('payment_status', payment);
  if (status === 'open') query = query.not('order_status', 'in', '(Selesai,Dibatalkan)');
  else if (status) query = query.eq('order_status', status);
  const term = cleanQuery(q);
  if (term) {
    const ors = [`invoice_number.ilike.*${term}*`, `customer_name.ilike.*${term}*`];
    const digits = term.replace(/[^0-9]/g, '');
    if (digits.length >= 3) {
      // 0812… dan 62812… dianggap sama
      const core = digits.replace(/^(62|0)/, '');
      ors.push(`customer_phone.ilike.*${core || digits}*`);
    }
    query = query.or(ors.join(','));
  }
  let res;
  try { res = await query; } catch (e) { throw friendlyError(e); }
  if (res.error) throw friendlyError(res.error);
  return { rows: res.data.map(flattenOrder), count: res.count ?? res.data.length };
}

export async function ordersForRange(start, end) {
  const rows = await run(init().from('orders').select(ORDER_LIST_COLS + ', description, pickup_location, destination, distance, notes, additional_fee_is_revenue, customer_phone')
    .gte('transaction_date', start).lte('transaction_date', end)
    .order('transaction_date').order('created_at'));
  return rows.map(flattenOrder);
}

export async function updateOrder(id, patch) {
  return run(init().from('orders').update(patch).eq('id', id).select('id').single());
}
export async function deleteOrder(id) {
  return run(init().from('orders').delete().eq('id', id));
}

// ---------- Pengeluaran ----------
const EXPENSE_COLS = '*, expense_categories(name)';
function flattenExpense(e) {
  const { expense_categories: c, ...rest } = e;
  return { ...rest, category_name: c?.name ?? '' };
}
export async function listExpenses({ q, start, end, category, limit = 50, offset = 0 } = {}) {
  let query = init().from('expenses').select(EXPENSE_COLS, { count: 'exact' })
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (start) query = query.gte('expense_date', start);
  if (end) query = query.lte('expense_date', end);
  if (category) query = query.eq('category_id', category);
  const term = cleanQuery(q);
  if (term) query = query.or(`description.ilike.*${term}*,notes.ilike.*${term}*`);
  let res;
  try { res = await query; } catch (e) { throw friendlyError(e); }
  if (res.error) throw friendlyError(res.error);
  return { rows: res.data.map(flattenExpense), count: res.count ?? res.data.length };
}
export async function expensesForRange(start, end) {
  const rows = await run(init().from('expenses').select(EXPENSE_COLS)
    .gte('expense_date', start).lte('expense_date', end)
    .order('expense_date').order('created_at'));
  return rows.map(flattenExpense);
}
export async function saveExpense(row) {
  const { id, ...data } = row;
  if (id) return run(init().from('expenses').update(data).eq('id', id).select().single());
  return run(init().from('expenses').insert(data).select().single());
}
export async function deleteExpense(id) {
  return run(init().from('expenses').delete().eq('id', id));
}

// ---------- Laporan (fungsi database) ----------
export async function summary(start, end) {
  return run(init().rpc('get_financial_summary', { p_start: start, p_end: end }));
}
export async function dailySeries(start, end) {
  return run(init().rpc('get_daily_series', { p_start: start, p_end: end }));
}
export async function outstanding() {
  return run(init().rpc('get_outstanding'));
}

export async function recentActivity(limit = 6) {
  const [orders, expenses] = await Promise.all([
    run(init().from('orders').select('id, invoice_number, customer_name, total_amount, order_status, payment_status, created_at, transaction_date, service_categories(name)')
      .order('created_at', { ascending: false }).limit(limit)),
    run(init().from('expenses').select('id, description, amount, expense_date, created_at, expense_categories(name)')
      .order('created_at', { ascending: false }).limit(limit)),
  ]);
  return [
    ...orders.map((o) => ({ kind: 'order', ...flattenOrder(o) })),
    ...expenses.map((e) => ({ kind: 'expense', ...flattenExpense(e) })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit + 2);
}
