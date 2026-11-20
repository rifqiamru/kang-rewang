// Data Order: daftar, pencarian, filter, detail, ubah status, hapus, duplikasi.
import * as api from '../api.js';
import { icon } from '../icons.js';
import {
  $, esc, toast, loadingHTML, errorHTML, emptyHTML, badge, debounce, confirmDialog,
  copyText, openWhatsApp, selectOptions, openSheet, withBusy,
} from '../ui.js';
import { rupiah, formatDateShort, formatDateLong, formatDateTime, formatQuantity, todayJakarta } from '../lib/format.js';
import { PAYMENT_STATUSES, ORDER_STATUSES } from '../lib/calc.js';
import { buildNotaText } from '../lib/templates.js';
import { pdfActionsHTML, bindPdfActions } from './nota.js';

const PAGE = 30;

export async function render(root, params, ctx) {
  if (params.id) return renderDetail(root, params.id, ctx);
  return renderList(root, ctx);
}

// ------------------------------------------------------------------ Daftar
async function renderList(root, ctx) {
  const q0 = ctx.query();
  const f = {
    q: q0.q || '', start: q0.start || '', end: q0.end || '', service: q0.service || '',
    payment: q0.payment || '', status: q0.status || '',
  };
  let offset = 0;
  let rows = [];

  root.innerHTML = `
    <div class="search-bar">
      <label class="search">${icon('search')}
        <input type="search" id="q" placeholder="Cari no. nota, nama, atau no. WA" value="${esc(f.q)}" enterkeyhint="search"></label>
      <button class="icon-btn icon-btn-box" id="btn-filter" aria-label="Filter">${icon('filter')}<span class="dot" hidden></span></button>
    </div>
    <div class="chip-scroll" id="quick-status"></div>
    <div id="active-filters"></div>
    <p class="muted small" id="count"></p>
    <div id="list"></div>
    <div id="more"></div>`;

  const listEl = $('#list', root);
  const quick = [
    ['', 'Semua'], ['open', 'Belum selesai'], ['unpaid', 'Belum lunas'],
    ['Selesai', 'Selesai'], ['Dibatalkan', 'Dibatalkan'],
  ];
  function renderQuick() {
    const cur = f.payment === 'unpaid' ? 'unpaid' : f.status;
    $('#quick-status', root).innerHTML = quick.map(([v, l]) =>
      `<button class="chip-btn ${v === cur || (!v && !cur) ? 'active' : ''}" data-v="${v}">${l}</button>`).join('');
  }
  $('#quick-status', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const v = b.dataset.v;
    if (v === 'unpaid') { f.payment = 'unpaid'; f.status = ''; } else { f.status = v; if (f.payment === 'unpaid') f.payment = ''; }
    reload();
  });

  function renderActive() {
    const tags = [];
    if (f.start || f.end) tags.push(`${f.start ? formatDateShort(f.start) : '…'} – ${f.end ? formatDateShort(f.end) : '…'}`);
    if (f.service) tags.push(ctx.serviceName(f.service) || 'Kategori');
    if (f.payment && f.payment !== 'unpaid') tags.push(f.payment);
    if (f.status && f.status !== 'open' && !quick.some(([v]) => v === f.status)) tags.push(f.status);
    $('#btn-filter .dot', root).hidden = !(f.start || f.end || f.service || (f.payment && f.payment !== 'unpaid') || ['Pesanan', 'Diproses', 'Dikirim'].includes(f.status));
    $('#active-filters', root).innerHTML = tags.length
      ? `<div class="tag-row">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
         <button class="btn btn-link btn-sm" id="btn-clear">Hapus filter</button></div>` : '';
    $('#btn-clear', root)?.addEventListener('click', () => {
      Object.assign(f, { start: '', end: '', service: '', payment: '', status: '' });
      reload();
    });
  }

  function syncUrl() {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    history.replaceState(null, '', '#/order' + (p.toString() ? '?' + p : ''));
  }

  async function fetchPage() {
    const res = await api.listOrders({ ...f, limit: PAGE, offset });
    return { ...res, all: false };
  }

  async function reload() {
    offset = 0;
    rows = [];
    renderQuick();
    renderActive();
    syncUrl();
    listEl.innerHTML = loadingHTML();
    $('#more', root).innerHTML = '';
    $('#count', root).textContent = '';
    await loadMore();
  }

  async function loadMore() {
    try {
      const res = await fetchPage();
      rows = rows.concat(res.rows);
      offset += PAGE;
      $('#count', root).textContent = res.count ? `${res.count} transaksi` : '';
      listEl.innerHTML = rows.length ? `<ul class="order-list">${rows.map(orderCard).join('')}</ul>`
        : emptyHTML(f.q ? 'Tidak ada transaksi yang cocok.' : 'Belum ada transaksi.',
          '<a href="#/nota" class="btn btn-accent btn-sm">+ Buat Nota</a>');
      const hasMore = !res.all && rows.length < res.count;
      $('#more', root).innerHTML = hasMore ? '<button class="btn btn-ghost btn-block" id="btn-more">Muat lebih banyak</button>' : '';
      $('#btn-more', root)?.addEventListener('click', (e) => withBusy(e.currentTarget, loadMore, 'Memuat…'));
    } catch (e) {
      listEl.innerHTML = errorHTML(e.message);
      listEl.querySelector('[data-retry]')?.addEventListener('click', reload);
    }
  }

  $('#q', root).addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); reload(); }, 350));
  $('#btn-filter', root).addEventListener('click', () => openFilter(ctx, f, reload));
  await reload();
}

function orderCard(o) {
  const cancelled = o.order_status === 'Dibatalkan';
  return `<li><a href="#/order/${o.id}" class="order-card ${cancelled ? 'is-cancelled' : ''}">
    <div class="oc-top"><b>${esc(o.invoice_number)}</b><span class="muted small">${formatDateShort(o.transaction_date)}</span></div>
    <div class="oc-mid"><span>${esc(o.customer_name || '—')}<small>${esc(o.service_name || '')}</small></span>
      <b class="oc-total">${rupiah(o.total_amount)}</b></div>
    <div class="oc-bot">${badge(o.payment_status)}${badge(o.order_status)}
      ${o.payment_status === 'DP' ? `<span class="muted small">Sisa ${rupiah(o.remaining_amount)}</span>` : ''}</div>
  </a></li>`;
}

function openFilter(ctx, f, onApply) {
  const s = openSheet({
    title: 'Filter transaksi',
    content: `<form id="filter-form" class="form-stack">
      <div class="grid-2">
        <label class="field"><span class="field-label">Dari tanggal</span><input type="date" name="start" value="${esc(f.start)}"></label>
        <label class="field"><span class="field-label">Sampai tanggal</span><input type="date" name="end" value="${esc(f.end)}"></label>
      </div>
      <div class="chip-scroll">
        <button type="button" class="chip-btn" data-range="today">Hari ini</button>
        <button type="button" class="chip-btn" data-range="7">7 hari</button>
        <button type="button" class="chip-btn" data-range="30">30 hari</button>
      </div>
      <label class="field"><span class="field-label">Kategori penjualan</span>
        <select name="service">${selectOptions(ctx.serviceCategories, f.service, { valueKey: 'id', labelKey: 'name', placeholder: 'Semua kategori' })}</select></label>
      <label class="field"><span class="field-label">Status pembayaran</span>
        <select name="payment">${selectOptions([...PAYMENT_STATUSES, { value: 'unpaid', label: 'Belum lunas (Belum Bayar + DP)' }], f.payment, { placeholder: 'Semua' })}</select></label>
      <label class="field"><span class="field-label">Status transaksi</span>
        <select name="status">${selectOptions([...ORDER_STATUSES, { value: 'open', label: 'Belum selesai (semua)' }], f.status, { placeholder: 'Semua' })}</select></label>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-reset>Reset</button>
        <button type="submit" class="btn btn-primary">Terapkan</button>
      </div></form>`,
  });
  const form = s.el.querySelector('#filter-form');
  s.el.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    const t = todayJakarta();
    const r = b.dataset.range;
    form.end.value = t;
    form.start.value = r === 'today' ? t : addDaysLocal(t, -(Number(r) - 1));
  }));
  s.el.querySelector('[data-reset]').addEventListener('click', () => {
    form.reset();
    ['start', 'end', 'service', 'payment', 'status'].forEach((k) => { form[k].value = ''; });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.start.value && form.end.value && form.start.value > form.end.value) {
      toast('Tanggal awal harus sebelum tanggal akhir.', 'error');
      return;
    }
    Object.assign(f, {
      start: form.start.value, end: form.end.value, service: form.service.value,
      payment: form.payment.value, status: form.status.value,
    });
    s.close();
    onApply();
  });
}

function addDaysLocal(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ Detail
async function renderDetail(root, id, ctx) {
  root.innerHTML = loadingHTML('Memuat transaksi…');
  let o;
  try { o = await api.getOrder(id); } catch (e) {
    root.innerHTML = errorHTML(e.message);
    root.querySelector('[data-retry]')?.addEventListener('click', () => renderDetail(root, id, ctx));
    return;
  }
  if (!o) { root.innerHTML = emptyHTML('Transaksi tidak ditemukan atau sudah dihapus.', '<a href="#/order" class="btn btn-ghost btn-sm">Kembali ke Data Penjualan</a>'); return; }

  const text = buildNotaText(o, ctx.settings);
  const cancelled = o.order_status === 'Dibatalkan';
  root.innerHTML = `
    <a href="#/order" class="back-link">${icon('left')} Data Penjualan</a>
    <section class="card detail-head ${cancelled ? 'is-cancelled' : ''}">
      <div class="dh-top"><h2>${esc(o.invoice_number)}</h2><span>${badge(o.payment_status)}${badge(o.order_status)}</span></div>
      <p class="dh-total">${rupiah(o.total_amount)}</p>
      <p class="muted small">${formatDateLong(o.transaction_date)} · dibuat ${formatDateTime(o.created_at)}</p>
      ${cancelled ? '<p class="small neg">Transaksi dibatalkan — tidak dihitung dalam pendapatan & rekap.</p>' : ''}
    </section>

    ${pdfActionsHTML()}
    <div class="action-grid">
      <button class="btn btn-primary" id="btn-copy">${icon('copy')} Salin Teks Nota</button>
      <button class="btn btn-wa" id="btn-wa">${icon('whatsapp')} Kirim Teks WhatsApp</button>
    </div>

    <section class="card">
      <h3 class="card-title">Ubah status cepat</h3>
      <div class="quick-status">
        ${o.payment_status !== 'Lunas' && !cancelled ? `<button class="btn btn-success" data-quick="lunas">${icon('check')} Tandai Lunas</button>` : ''}
        ${o.order_status !== 'Selesai' && !cancelled ? `<button class="btn btn-primary" data-quick="selesai">${icon('check')} Tandai Selesai</button>` : ''}
        <label class="field"><span class="field-label">Status transaksi</span>
          <select id="sel-status">${selectOptions(ORDER_STATUSES, o.order_status)}</select></label>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">Pelanggan & pengiriman</h3>
      <dl class="kv">
        <div><dt>Pelanggan</dt><dd>${esc(o.customer_name || '—')}</dd></div>
        <div><dt>WhatsApp</dt><dd>${o.customer_phone ? esc(o.customer_phone) : '—'}</dd></div>
        <div><dt>Kategori</dt><dd>${esc(o.service_name || '—')}</dd></div>
        ${o.description ? `<div><dt>Keterangan</dt><dd>${esc(o.description)}</dd></div>` : ''}
        ${o.shipping_address ? `<div><dt>Alamat</dt><dd>${esc(o.shipping_address)}</dd></div>` : ''}
        ${o.courier ? `<div><dt>Kurir</dt><dd>${esc(o.courier)}</dd></div>` : ''}
        ${o.tracking_number ? `<div><dt>No. resi</dt><dd>${esc(o.tracking_number)}</dd></div>` : ''}
        ${o.notes ? `<div><dt>Catatan internal</dt><dd>${esc(o.notes)}</dd></div>` : ''}
      </dl>
    </section>

    <section class="card">
      <h3 class="card-title">Rincian barang</h3>
      ${o.items.length ? `<ul class="item-list">${o.items.map((it, i) => `
        <li><span>${i + 1}. ${esc(it.item_name)}<small>${formatQuantity(it.quantity)} × ${rupiah(it.unit_price)}</small></span><b>${rupiah(it.subtotal)}</b></li>`).join('')}</ul>`
        : '<p class="muted small">Tanpa rincian barang.</p>'}
      <div class="calc-box">
        <div class="calc-line"><span>Total harga barang</span><span>${rupiah(o.goods_total)}</span></div>
        ${o.shipping_fee ? `<div class="calc-line"><span>Ongkos kirim</span><span>${rupiah(o.shipping_fee)}</span></div>` : ''}
        ${o.additional_fee ? `<div class="calc-line"><span>Biaya tambahan${o.additional_fee_is_revenue ? '' : ' (penggantian)'}</span><span>${rupiah(o.additional_fee)}</span></div>` : ''}
        ${o.discount ? `<div class="calc-line"><span>Diskon</span><span>−${rupiah(o.discount)}</span></div>` : ''}
        <div class="calc-line calc-total"><span>Total tagihan</span><span>${rupiah(o.total_amount)}</span></div>
        <div class="calc-line"><span>Sudah dibayar (${esc(o.payment_method)})</span><span>${rupiah(o.paid_amount)}</span></div>
        <div class="calc-line ${o.remaining_amount ? 'calc-warn' : ''}"><span>Sisa pembayaran</span><span>${rupiah(o.remaining_amount)}</span></div>
        <div class="calc-split">
          <div><small>Pendapatan penjualan</small><b>${rupiah(o.sales_revenue)}</b></div>
          <div><small>Ongkir & titipan</small><b>${rupiah(o.trust_amount)}</b></div>
        </div>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">Pratinjau teks nota WhatsApp</h3>
      <pre class="wa-preview">${esc(text)}</pre>
    </section>

    <div class="action-grid">
      <a class="btn btn-ghost" href="#/nota/ubah/${o.id}">${icon('edit')} Edit</a>
      <a class="btn btn-ghost" href="#/nota/duplikat/${o.id}">${icon('duplicate')} Duplikasi</a>
      ${!cancelled ? `<button class="btn btn-ghost btn-danger-text" id="btn-cancel">${icon('x')} Batalkan</button>` : ''}
      <button class="btn btn-ghost btn-danger-text" id="btn-delete">${icon('trash')} Hapus</button>
    </div>`;

  $('#btn-copy', root).onclick = () => copyText(text);
  $('#btn-wa', root).onclick = () => openWhatsApp(text, o.customer_phone);
  bindPdfActions(root, o, ctx);
  const reload = () => renderDetail(root, id, ctx);

  async function patch(btn, data, msg) {
    await withBusy(btn, async () => {
      try {
        await api.updateOrder(o.id, data);
        toast(msg, 'success');
        reload();
      } catch (e) { toast(e.message, 'error'); }
    });
  }
  root.querySelector('[data-quick=lunas]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await confirmDialog({ title: 'Tandai lunas?', message: `Pembayaran ${esc(o.invoice_number)} sebesar <b>${rupiah(o.total_amount)}</b> dianggap sudah diterima penuh.`, okText: 'Ya, lunas' });
    if (ok) patch(btn, { payment_status: 'Lunas' }, 'Ditandai lunas.');
  });
  root.querySelector('[data-quick=selesai]')?.addEventListener('click', (e) =>
    patch(e.currentTarget, { order_status: 'Selesai' }, 'Order selesai. Pendapatan penjualan masuk laporan.'));
  $('#sel-status', root).addEventListener('change', async (e) => {
    const v = e.target.value;
    if (v === 'Dibatalkan') {
      const ok = await confirmDialog({ title: 'Batalkan transaksi?', message: 'Transaksi tidak akan dihitung sebagai pendapatan. Riwayat tetap tersimpan.', okText: 'Batalkan transaksi', danger: true });
      if (!ok) { e.target.value = o.order_status; return; }
    }
    patch(null, { order_status: v }, `Status diubah menjadi ${v}.`);
  });
  $('#btn-cancel', root)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await confirmDialog({ title: 'Batalkan transaksi?', message: 'Transaksi tidak akan dihitung sebagai pendapatan. Riwayat tetap tersimpan dan bisa diaktifkan lagi.', okText: 'Batalkan transaksi', danger: true });
    if (ok) patch(btn, { order_status: 'Dibatalkan' }, 'Transaksi dibatalkan.');
  });
  $('#btn-delete', root).addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const ok = await confirmDialog({
      title: 'Hapus permanen?',
      message: `Transaksi <b>${esc(o.invoice_number)}</b> beserta rincian barangnya akan <b>dihapus permanen</b> dan tidak bisa dikembalikan.<br><br>Jika hanya batal, gunakan <b>Batalkan</b> agar riwayat tetap ada.`,
      okText: 'Hapus permanen', danger: true,
    });
    if (!ok) return;
    await withBusy(btn, async () => {
      try {
        await api.deleteOrder(o.id);
        toast(`Transaksi ${o.invoice_number} dihapus.`, 'success');
        ctx.navigate('#/order');
      } catch (err) { toast(err.message, 'error'); }
    }, 'Menghapus…');
  });
}
