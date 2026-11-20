// Rekap Harian: otomatis dari database untuk tanggal yang dipilih.
import * as api from '../api.js';
import { icon } from '../icons.js';
import { $, esc, loadingHTML, errorHTML, badge, copyText, openWhatsApp } from '../ui.js';
import { rupiah, todayJakarta, addDays, formatDateFull } from '../lib/format.js';
import { buildRekapText, rekapKas } from '../lib/templates.js';

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
      const [summary, orders, expenses, prevBalance] = await Promise.all([
        api.summary(date, date), api.ordersForRange(date, date), api.expensesForRange(date, date),
        api.balance(addDays(date, -1)),
      ]);
      const openingBalance = prevBalance.balance;
      const kas = rekapKas({ orders, expenses, openingBalance });
      const text = buildRekapText({ date, orders, expenses, openingBalance });
      const active = orders.filter((o) => o.order_status !== 'Dibatalkan');
      const notDone = active.filter((o) => o.order_status !== 'Selesai');
      const cancelled = orders.length - active.length;
      body.innerHTML = `
        <section class="card hero hero-compact">
          <div class="hero-top">
            <span class="hero-label">Saldo akhir</span>
            <span class="hero-value ${kas.closing < 0 ? 'neg' : ''}">${rupiah(kas.closing)}</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><span class="stat-label">Saldo awal</span><span class="stat-value">${rupiah(kas.opening)}</span></div>
            <div class="stat"><span class="stat-label">Jumlah order</span><span class="stat-value">${summary.order_count}</span></div>
            <div class="stat"><span class="stat-label">Pemasukan (ongkos)</span><span class="stat-value">${rupiah(kas.totalIn)}</span></div>
            <div class="stat"><span class="stat-label">Pengeluaran</span><span class="stat-value">${rupiah(kas.totalOut)}</span></div>
          </div>
        </section>
        ${notDone.length ? `<div class="card notice notice-info">${icon('info')}<div><b>${notDone.length} order belum Selesai</b>
          <p>Ongkosnya (${rupiah(summary.pending_revenue)}) baru masuk pemasukan setelah status diubah menjadi Selesai.</p></div></div>` : ''}

        <div class="action-grid">
          <button class="btn btn-primary" id="btn-copy">${icon('copy')} Salin Rekap</button>
          <button class="btn btn-wa" id="btn-wa">${icon('whatsapp')} Bagikan ke WhatsApp</button>
        </div>

        <section class="card">
          <h3 class="card-title">Teks rekap WhatsApp</h3>
          <pre class="wa-preview">${esc(text)}</pre>
        </section>

        <section class="card">
          <h3 class="card-title">Transaksi (${active.length})</h3>
          ${active.length ? `<ul class="mini-list">${active.map((o) => `
            <li><a href="#/order/${o.id}"><span><b>${esc(o.customer_name || '—')}</b> · ${esc(o.invoice_number)}
              <small>${esc(o.service_name || '')} · tagihan ${rupiah(o.total_amount)}</small></span>
              <span class="ml-side"><b>ongkos ${rupiah(o.service_revenue)}</b>${o.order_status !== 'Selesai' ? badge(o.order_status) : badge(o.payment_status)}</span></a></li>`).join('')}</ul>`
            : '<p class="muted small">Belum ada transaksi pada tanggal ini.</p>'}
          ${cancelled ? `<p class="muted small">${cancelled} transaksi dibatalkan tidak dihitung.</p>` : ''}
        </section>

        <section class="card">
          <h3 class="card-title">Pengeluaran (${expenses.length})</h3>
          ${expenses.length ? `<ul class="mini-list">${expenses.map((e) => `
            <li><span><b>${esc(e.description || e.category_name)}</b><small>${esc(e.category_name)} · ${esc(e.payment_method)}</small></span>
              <span class="ml-side"><b class="neg">−${rupiah(e.amount)}</b></span></li>`).join('')}</ul>`
            : '<p class="muted small">Tidak ada pengeluaran.</p>'}
          <a href="#/pengeluaran" class="btn btn-ghost btn-sm btn-block">${icon('plus')} Catat pengeluaran</a>
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
