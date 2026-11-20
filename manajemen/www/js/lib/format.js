// Format angka, Rupiah, tanggal (Asia/Jakarta) dan nomor HP.
// Modul murni: tidak menyentuh DOM, bisa diuji di Node.

export const TZ = 'Asia/Jakarta';

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** 91000 → "91.000" */
export function formatNumber(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + s;
}

/** 91000 → "Rp91.000" ; {space:true} → "Rp 91.000" ; negatif → "-Rp5.000" */
export function rupiah(n, { space = false } = {}) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + 'Rp' + (space ? ' ' : '') + formatNumber(Math.abs(v));
}

/** Ringkas untuk sumbu grafik: 1500000 → "1,5 jt", 45000 → "45 rb" */
export function rupiahShort(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e9) return sign + trimZero(a / 1e9) + ' M';
  if (a >= 1e6) return sign + trimZero(a / 1e6) + ' jt';
  if (a >= 1e3) return sign + trimZero(a / 1e3) + ' rb';
  return sign + String(a);
}
function trimZero(x) {
  return (Math.round(x * 10) / 10).toString().replace('.', ',');
}

/** "Rp 23.000" / "23.000" / "23000" → 23000 (bilangan bulat ≥ 0) */
export function parseAmount(str) {
  if (typeof str === 'number') return Math.max(0, Math.round(str));
  const digits = String(str ?? '').replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** "1,5" / "2" → 1.5 / 2 (jumlah barang boleh desimal, mis. kg) */
export function parseQuantity(str) {
  if (typeof str === 'number') return str;
  const v = parseFloat(String(str ?? '').replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/** 1.5 → "1,5" */
export function formatQuantity(q) {
  const v = Number(q) || 0;
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ',');
}

// ---------- Tanggal (string ISO "YYYY-MM-DD", tanpa pergeseran zona waktu) ----------

/** Tanggal hari ini di Asia/Jakarta, "YYYY-MM-DD". */
export function todayJakarta(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now);
}

function parts(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}
function toUTC(iso) {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUTC(dt) {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function dayOfWeek(iso) {
  return toUTC(iso).getUTCDay();
}

/** Senin sebagai awal minggu. */
export function startOfWeek(iso) {
  const dow = dayOfWeek(iso);
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}
export function startOfMonth(iso) {
  const { y, m } = parts(iso);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}
export function endOfMonth(iso) {
  const { y, m } = parts(iso);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
}

/** "2026-11-19" → "19 November 2026" */
export function formatDateLong(iso) {
  if (!iso) return '—';
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
/** "2026-11-19" → "19 Nov 2026" */
export function formatDateShort(iso) {
  if (!iso) return '—';
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
/** "2026-11-19" → "Kamis, 19 November 2026" */
export function formatDateFull(iso) {
  return `${DAYS[dayOfWeek(iso)]}, ${formatDateLong(iso)}`;
}
/** "2026-11-19" → "19/11" */
export function formatDayMonth(iso) {
  const { m, d } = parts(iso);
  return `${d}/${m}`;
}
/** Timestamp → "19 Nov 2026 14:05" (WIB) */
export function formatDateTime(ts) {
  if (!ts) return '—';
  const dt = new Date(ts);
  const date = todayJakarta(dt);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(dt);
  return `${formatDateShort(date)} ${time}`;
}

/** Rentang periode laporan. key: today|yesterday|week|month|last_month */
export function periodRange(key, today = todayJakarta()) {
  switch (key) {
    case 'today': return { start: today, end: today, label: 'Hari ini' };
    case 'yesterday': { const y = addDays(today, -1); return { start: y, end: y, label: 'Kemarin' }; }
    case 'week': return { start: startOfWeek(today), end: today, label: 'Minggu ini' };
    case 'month': return { start: startOfMonth(today), end: today, label: 'Bulan ini' };
    case 'last_month': {
      const prev = addDays(startOfMonth(today), -1);
      return { start: startOfMonth(prev), end: endOfMonth(prev), label: 'Bulan sebelumnya' };
    }
    default: throw new Error('Periode tidak dikenal: ' + key);
  }
}

export function periodLabel(start, end) {
  if (start === end) return formatDateLong(start);
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

export function daysBetween(start, end) {
  return Math.round((toUTC(end) - toUTC(start)) / 86400000) + 1;
}

// ---------- Nomor HP ----------

/** Simpan hanya angka (dan + di depan). "0812-3456 789" → "08123456789" */
export function cleanPhone(str) {
  const s = String(str ?? '').trim();
  const plus = s.startsWith('+') ? '+' : '';
  return plus + s.replace(/[^0-9]/g, '');
}

/** Untuk link wa.me: "08123" → "628123", "+628123" → "628123" */
export function waNumber(str) {
  let s = cleanPhone(str).replace(/^\+/, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
}

export function isValidPhone(str) {
  const s = cleanPhone(str);
  return s === '' || /^\+?[0-9]{8,15}$/.test(s);
}
