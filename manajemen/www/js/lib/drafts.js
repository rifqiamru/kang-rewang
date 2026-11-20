// Draft nota sementara di localStorage (BUKAN database utama).
// Dipakai agar isian tidak hilang saat pindah halaman atau koneksi putus.
// Setiap draft membawa client_request_id; server memakainya sebagai kunci
// idempoten sehingga simpan ulang draft tidak pernah membuat transaksi ganda.

const PREFIX = 'kr.draft.';

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export function draftKey(mode, id) {
  return PREFIX + (mode === 'edit' ? `edit.${id}` : 'new');
}

export function loadDraft(key) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key, data) {
  try {
    storage()?.setItem(key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch { /* penyimpanan penuh / mode privat: abaikan */ }
}

export function clearDraft(key) {
  try { storage()?.removeItem(key); } catch { /* abaikan */ }
}

/** Draft nota baru yang gagal disimpan karena offline dan menunggu dikirim ulang. */
export function pendingDrafts() {
  const out = [];
  const s = storage();
  if (!s) return out;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    const d = loadDraft(k);
    if (d?.pendingSave) out.push({ key: k, draft: d });
  }
  return out;
}

export function hasMeaningfulContent(d) {
  if (!d?.form) return false;
  const f = d.form;
  return Boolean(f.customer_name || f.customer_phone || f.description || f.pickup_location ||
    f.destination || Number(f.service_fee) || (f.items || []).some((it) => it.item_name || Number(it.unit_price)));
}

// Preferensi tampilan (aman di localStorage).
export function getPref(name, fallback) {
  try {
    const v = storage()?.getItem('kr.pref.' + name);
    return v === null || v === undefined ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
export function setPref(name, value) {
  try { storage()?.setItem('kr.pref.' + name, JSON.stringify(value)); } catch { /* abaikan */ }
}
