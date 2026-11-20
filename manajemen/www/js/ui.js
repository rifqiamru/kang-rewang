// Utilitas antarmuka: escape HTML, toast, dialog konfirmasi, sheet, salin teks,
// input uang, dan status loading.
import { icon } from './icons.js';
import { formatNumber, parseAmount } from './lib/format.js';
import { whatsappUrl } from './lib/templates.js';
import { waNumber } from './lib/format.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

// ---------- Toast ----------
export function toast(message, type = 'info', ms = 3200) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const ic = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  el.innerHTML = `${icon(ic)}<span>${esc(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', close);
  setTimeout(close, type === 'error' ? Math.max(ms, 5000) : ms);
}

// ---------- Modal / sheet ----------
let openCount = 0;
/**
 * Buka bottom sheet. content: HTML string. Mengembalikan { el, close }.
 * onClose dipanggil saat ditutup (oleh tombol X, backdrop, atau Esc).
 */
export function openSheet({ title, content, onClose, wide = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop"></div>
    <section class="sheet ${wide ? 'sheet-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Tutup">${icon('x')}</button>
      </header>
      <div class="sheet-body">${content}</div>
    </section>`;
  document.body.appendChild(wrap);
  openCount++;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('show'));
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('show');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      wrap.remove();
      openCount--;
      if (openCount <= 0) { openCount = 0; document.body.classList.remove('no-scroll'); }
    }, 220);
    onClose?.(result);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.sheet-backdrop').addEventListener('click', () => close());
  wrap.querySelector('[data-close]').addEventListener('click', () => close());
  const first = wrap.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
  if (first && window.matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 250);
  return { el: wrap, close };
}

/** Dialog konfirmasi. Mengembalikan Promise<boolean>. */
export function confirmDialog({ title = 'Konfirmasi', message = '', okText = 'Ya, lanjutkan', cancelText = 'Batal', danger = false }) {
  return new Promise((resolve) => {
    const s = openSheet({
      title,
      content: `
        <p class="confirm-msg">${message}</p>
        <div class="btn-row">
          <button class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>
        </div>`,
      onClose: (r) => resolve(r === true),
    });
    s.el.querySelector('[data-cancel]').addEventListener('click', () => s.close(false));
    s.el.querySelector('[data-ok]').addEventListener('click', () => s.close(true));
  });
}

// ---------- Salin & bagikan ----------
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('copy failed');
    }
    toast('Teks berhasil disalin. Tinggal tempel di WhatsApp.', 'success');
    return true;
  } catch {
    toast('Gagal menyalin otomatis. Tekan lama pada teks lalu pilih Salin.', 'error');
    return false;
  }
}

export function openWhatsApp(text, phone = '') {
  const url = whatsappUrl(text, phone ? waNumber(phone) : '');
  window.open(url, '_blank', 'noopener');
}

// ---------- Input uang (keyboard numerik + pemisah ribuan) ----------
export function moneyInputHTML({ name, value = 0, label, placeholder = '0', hint = '', required = false, id }) {
  const v = Number(value) ? formatNumber(value) : '';
  return `
    <label class="field">
      <span class="field-label">${esc(label)}${required ? ' <b class="req">*</b>' : ''}</span>
      <span class="money">
        <span class="money-prefix">Rp</span>
        <input type="text" inputmode="numeric" autocomplete="off" data-money name="${esc(name)}" ${id ? `id="${esc(id)}"` : ''}
          value="${v}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''}>
      </span>
      ${hint ? `<span class="field-hint">${hint}</span>` : ''}
    </label>`;
}

/** Pasang format ribuan pada semua input [data-money] di dalam root. */
export function bindMoneyInputs(root) {
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches?.('[data-money]')) return;
    const n = parseAmount(el.value);
    const formatted = n ? formatNumber(n) : '';
    if (el.value !== formatted) {
      el.value = formatted;
      el.setSelectionRange?.(formatted.length, formatted.length);
    }
  });
}
export function moneyValue(el) {
  return parseAmount(el?.value);
}

// ---------- Loading & kosong ----------
export function loadingHTML(text = 'Memuat data…') {
  return `<div class="loading"><span class="spinner"></span><span>${esc(text)}</span></div>`;
}
export function emptyHTML(text, actionHTML = '') {
  return `<div class="empty">${icon('clipboard')}<p>${esc(text)}</p>${actionHTML}</div>`;
}
export function errorHTML(text, retry = true) {
  return `<div class="empty empty-error">${icon('cloudOff')}<p>${esc(text)}</p>
    ${retry ? `<button class="btn btn-ghost btn-sm" data-retry>${icon('refresh')} Coba lagi</button>` : ''}</div>`;
}

/** Kunci tombol saat proses berjalan untuk mencegah klik ganda. */
export async function withBusy(btn, fn, busyText = 'Menyimpan…') {
  if (!btn || btn.dataset.busy === '1') return undefined;
  btn.dataset.busy = '1';
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm"></span> ${esc(busyText)}`;
  try {
    return await fn();
  } finally {
    btn.dataset.busy = '';
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

// ---------- Badge status ----------
const BADGE = {
  Lunas: 'success', DP: 'warn', 'Belum Bayar': 'danger',
  Selesai: 'success', Diproses: 'info', Menunggu: 'muted', Booking: 'info', Dibatalkan: 'danger-soft',
};
export function badge(text) {
  return `<span class="badge badge-${BADGE[text] || 'muted'}">${esc(text)}</span>`;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function selectOptions(list, selected, { valueKey = 'value', labelKey = 'label', placeholder } = {}) {
  const opts = placeholder !== undefined ? [`<option value="">${esc(placeholder)}</option>`] : [];
  for (const it of list) {
    const v = typeof it === 'object' ? it[valueKey] : it;
    const l = typeof it === 'object' ? it[labelKey] : it;
    opts.push(`<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`);
  }
  return opts.join('');
}
