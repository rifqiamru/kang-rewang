// Dashboard: ringkasan hari ini, periode, tombol cepat, aktivitas terbaru.
import * as api from '../api.js';
import { icon } from '../icons.js';
import { esc, loadingHTML, errorHTML, badge } from '../ui.js';
import { rupiah, todayJakarta, formatDateFull, periodRange, formatDateTime } from '../lib/format.js';
import { pendingDrafts, loadDraft, draftKey, hasMeaningfulContent } from '../lib/drafts.js';
import { openExpenseForm } from './expenses.js';

export async function render(root, _params, ctx) {
  const today = todayJakarta();
  const name = ctx.profile?.full_name || ctx.settings?.business?.owner_name || '';
  root.innerHTML = `
    <section class="hello">
      <p class="muted">${esc(formatDateFull(today))}</p>
      <h2>Halo${name ? ', ' + esc(name.split(' ')[0]) : ''} 👋</h2>
    </section>
    <div id="draft-banner"></div>
    <div class="quick-actions">
      <a href="#/nota" class="qa qa-accent">${icon('plus')}<span>Buat Nota</span></a>
      <button class="qa" id="qa-expense">${icon('fuel')}<span>Catat Pengeluaran</span></button>
      <a href="#/rekap" class="qa">${icon('calendar')}<span>Rekap Hari Ini</span></a>
    </div>
    <div id="dash-body">${loadingHTML('Mengambil data dari server…')}</div>`;

  root.querySelector('#qa-expense').onclick = () => openExpenseForm(ctx, { onSaved: () => load() });

  // Banner draft nota
  const pend = pendingDrafts();
  const nd = loadDraft(draftKey('new'));
  if (pend.length) {
    root.querySelector('#draft-banner').innerHTML = `<a href="#/nota" class="card notice notice-warn">${icon('cloudOff')}
      <div><b>${pend.length} nota belum tersimpan ke server</b><p>Akan dikirim otomatis saat koneksi kembali. Ketuk untuk membuka.</p></div></a>`;
  } else if (nd && hasMeaningfulContent(nd)) {
    root.querySelector('#draft-banner').innerHTML = `<a href="#/nota" class="card notice notice-info">${icon('edit')}
      <div><b>Ada draft nota yang belum disimpan</b><p>Ketuk untuk melanjutkan.</p></div></a>`;
  }

  const body = root.querySelector('#dash-body');
  async function load() {
    try {
      const week = periodRange('week', today);
      const month = periodRange('month', today);
      const [sToday, sWeek, sMonth, out, recent] = await Promise.all([
        api.summary(today, today),
        api.summary(week.start, week.end),
        api.summary(month.start, month.end),
        api.outstanding(),
        api.recentActivity(6),
      ]);
      body.innerHTML = view(sToday, sWeek, sMonth, out, recent);
    } catch (e) {
      body.innerHTML = errorHTML(e.message);
      body.querySelector('[data-retry]')?.addEventListener('click', load);
    }
  }
  await load();
}

function view(t, w, m, out, recent) {
  const profitCls = t.net_profit < 0 ? 'neg' : '';
  return `
    <section class="card hero">
      <div class="hero-top">
        <span class="hero-label">Keuntungan bersih hari ini</span>
        <span class="hero-value ${profitCls}">${rupiah(t.net_profit)}</span>
        <span class="hero-sub">Pendapatan jasa ${rupiah(t.service_revenue)} − pengeluaran ${rupiah(t.expense_total)}</span>
      </div>
      <div class="stat-grid">
        ${stat('Transaksi', t.order_count, 'receipt')}
        ${stat('Uang masuk', rupiah(t.cash_in), 'wallet')}
        ${stat('Pendapatan jasa', rupiah(t.service_revenue), 'scooter')}
        ${stat('Pengeluaran', rupiah(t.expense_total), 'fuel')}
      </div>
    </section>

    <div class="pill-row">
      <a class="pill-card" href="#/order?status=open">
        <span class="pill-num">${out.open_count}</span><span>Order belum selesai</span>${icon('right', 'chev')}
      </a>
      <a class="pill-card ${out.unpaid_count ? 'pill-warn' : ''}" href="#/order?payment=unpaid">
        <span class="pill-num">${out.unpaid_count}</span><span>Tagihan belum lunas${out.receivables ? `<small>${rupiah(out.receivables)}</small>` : ''}</span>${icon('right', 'chev')}
      </a>
    </div>

    <section class="card">
      <h3 class="card-title">Ringkasan periode</h3>
      <dl class="kv">
        <div><dt>Pendapatan jasa minggu ini</dt><dd>${rupiah(w.service_revenue)}</dd></div>
        <div><dt>Pendapatan jasa bulan ini</dt><dd>${rupiah(m.service_revenue)}</dd></div>
        <div><dt>Pengeluaran bulan ini</dt><dd>${rupiah(m.expense_total)}</dd></div>
        <div class="kv-strong"><dt>Keuntungan bersih bulan ini</dt><dd class="${m.net_profit < 0 ? 'neg' : 'pos'}">${rupiah(m.net_profit)}</dd></div>
      </dl>
      <a href="#/laporan" class="btn btn-ghost btn-block btn-sm">${icon('chart')} Lihat laporan lengkap</a>
    </section>

    <section class="card">
      <h3 class="card-title">Aktivitas terbaru</h3>
      ${recent.length ? `<ul class="activity">${recent.map(activity).join('')}</ul>`
        : '<p class="muted small">Belum ada aktivitas. Mulai dengan membuat nota pertama.</p>'}
    </section>`;
}

function stat(label, value, ic) {
  return `<div class="stat">${icon(ic)}<span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}

function activity(a) {
  if (a.kind === 'order') {
    return `<li><a href="#/order/${a.id}" class="act">
      <span class="act-ic act-order">${icon('receipt')}</span>
      <span class="act-main"><b>${esc(a.invoice_number)}</b> · ${esc(a.customer_name || '—')}
        <small>${esc(a.service_name || '')} · ${formatDateTime(a.created_at)}</small></span>
      <span class="act-side"><b>${rupiah(a.total_amount)}</b>${badge(a.order_status === 'Dibatalkan' ? 'Dibatalkan' : a.payment_status)}</span>
    </a></li>`;
  }
  return `<li><a href="#/pengeluaran" class="act">
    <span class="act-ic act-expense">${icon('fuel')}</span>
    <span class="act-main"><b>${esc(a.category_name)}</b>${a.description ? ' · ' + esc(a.description) : ''}
      <small>Pengeluaran · ${formatDateTime(a.created_at)}</small></span>
    <span class="act-side"><b class="neg">−${rupiah(a.amount)}</b></span>
  </a></li>`;
}
