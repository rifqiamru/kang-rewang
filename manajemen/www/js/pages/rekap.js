// Rekap Harian: otomatis dari database untuk tanggal yang dipilih.
import * as api from '../api.js';
import { icon } from '../icons.js';
import { $, esc, loadingHTML, errorHTML, badge, copyText, openWhatsApp } from '../ui.js';
import { rupiah, todayJakarta, addDays, formatDateFull } from '../lib/format.js';
import { buildRekapText } from '../lib/templates.js';

export async function render(root, _params, ctx) {
  let date = ctx.query().tanggal || todayJakarta();
  root.innerHTML = `
    <div class="date-nav card">
      <button class="icon-btn" id="prev" aria-label="Hari sebelumnya">${icon('left')}</button>
      <label class="date-pick">
        <span id="date-label"></span>
        <input type="date" id="date" value="${date}" aria-label="Pilih tanggal">
      </label>
      <button class="icon-btn" id="next" aria-label="Hari berikutnya">${icon('right')}</button>
    </div>
    <div id="rekap-body"></div>`;

  const body = $('#rekap-body', root);
  const input = $('#date', root);

  async function load() {
    $('#date-label', root).textContent = formatDateFull(date);
    input.value = date;
    $('#next', root).disabled = date >= todayJakarta();
    history.replaceState(null, '', `#/rekap?tanggal=${date}`);
    body.innerHTML = loadingHTML('Menyusun rekap…');
    try {
      const [summary, orders, expenses, balance] = await Promise.all([
        api.summary(date, date), api.ordersForRange(date, date), api.expensesForRange(date, date), api.balance(date),
      ]);
      const text = buildRekapText({ date, orders, expenses, summary, balance, settings: ctx.settings });
      const active = orders.filter((o) => o.order_status !== 'Dibatalkan');
      const cancelled = orders.filter((o) => o.order_status === 'Dibatalkan');
      body.innerHTML = `
        <section class="card hero hero-compact">
          <div class="hero-top">
            <span class="hero-label">Keuntungan bersih</span>
            <span class="hero-value ${summary.net_profit < 0 ? 'neg' : ''}">${rupiah(summary.net_profit)}</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><span class="stat-label">Jumlah order</span><span class="stat-value">${summary.order_count}</span></div>
            <div class="stat"><span class="stat-label">Uang masuk</span><span class="stat-value">${rupiah(summary.cash_in)}</span></div>
            <div class="stat"><span class="stat-label">Pendapatan jasa</span><span class="stat-value">${rupiah(summary.service_revenue)}</span></div>
            <div class="stat"><span class="stat-label">Pengeluaran</span><span class="stat-value">${rupiah(summary.expense_total)}</span></div>
          </div>
        </section>
        <section class="card"><dl class="kv">
          <div class="kv-strong"><dt>Saldo usaha akhir hari</dt><dd class="${balance.balance < 0 ? 'neg' : ''}">${rupiah(balance.balance)}</dd></div>
          ${summary.trust_funds ? `<div><dt>Dana titipan belanja (bukan pendapatan)</dt><dd>${rupiah(summary.trust_funds)}</dd></div>` : ''}
          ${summary.receivables ? `<div><dt>Belum dibayar (piutang)</dt><dd class="warn">${rupiah(summary.receivables)}</dd></div>` : ''}
          ${summary.pending_revenue ? `<div><dt>Jasa dari order belum selesai</dt><dd>${rupiah(summary.pending_revenue)}</dd></div>` : ''}
        </dl></section>

        <div class="action-grid">
          <button class="btn btn-primary" id="btn-copy">${icon('copy')} Salin Rekap</button>
          <button class="btn btn-wa" id="btn-wa">${icon('whatsapp')} Bagikan ke WhatsApp</button>
        </div>

        <section class="card">
          <h3 class="card-title">Transaksi (${active.length})</h3>
          ${active.length ? `<ul class="mini-list">${active.map((o) => `
            <li><a href="#/order/${o.id}"><span><b>${esc(o.invoice_number)}</b> · ${esc(o.customer_name || '—')}
              <small>${esc(o.service_name || '')} · jasa ${rupiah(o.service_revenue)}</small></span>
              <span class="ml-side"><b>${rupiah(o.total_amount)}</b>${badge(o.payment_status)}${o.order_status !== 'Selesai' ? badge(o.order_status) : ''}</span></a></li>`).join('')}</ul>`
            : '<p class="muted small">Belum ada transaksi pada tanggal ini.</p>'}
          ${cancelled.length ? `<p class="muted small">${cancelled.length} transaksi dibatalkan tidak dihitung.</p>` : ''}
        </section>

        <section class="card">
          <h3 class="card-title">Pengeluaran operasional (${expenses.length})</h3>
          ${expenses.length ? `<ul class="mini-list">${expenses.map((e) => `
            <li><span><b>${esc(e.category_name)}</b>${e.description ? ' · ' + esc(e.description) : ''}<small>${esc(e.payment_method)}</small></span>
              <span class="ml-side"><b class="neg">−${rupiah(e.amount)}</b></span></li>`).join('')}</ul>`
            : '<p class="muted small">Tidak ada pengeluaran.</p>'}
          <a href="#/pengeluaran" class="btn btn-ghost btn-sm btn-block">${icon('plus')} Catat pengeluaran</a>
        </section>

        <section class="card">
          <h3 class="card-title">Teks rekap WhatsApp</h3>
          <pre class="wa-preview">${esc(text)}</pre>
        </section>`;
      $('#btn-copy', root).onclick = () => copyText(text);
      $('#btn-wa', root).onclick = () => openWhatsApp(text);
    } catch (e) {
      body.innerHTML = errorHTML(e.message);
      body.querySelector('[data-retry]')?.addEventListener('click', load);
    }
  }

  $('#prev', root).onclick = () => { date = addDays(date, -1); load(); };
  $('#next', root).onclick = () => { if (date < todayJakarta()) { date = addDays(date, 1); load(); } };
  input.addEventListener('change', () => { if (input.value) { date = input.value; load(); } });
  await load();
}
