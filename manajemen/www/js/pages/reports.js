// Laporan Keuangan: pilihan periode, ringkasan, grafik, ekspor CSV.
import * as api from '../api.js';
import { icon } from '../icons.js';
import { $, esc, toast, loadingHTML, errorHTML, withBusy } from '../ui.js';
import { rupiah, todayJakarta, periodRange, periodLabel, daysBetween, formatDateShort } from '../lib/format.js';
import { barChart } from '../lib/chart.js';
import { downloadCSV } from '../lib/csv.js';

const PERIODS = [
  ['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['week', 'Minggu ini'],
  ['month', 'Bulan ini'], ['last_month', 'Bulan lalu'], ['custom', 'Pilih tanggal'],
];
const C_REVENUE = '#1749A8';
const C_EXPENSE = '#E89F00';
const C_LOSS = '#DC2626';

export async function render(root, _params, ctx) {
  const today = todayJakarta();
  let key = 'month';
  let range = periodRange('month', today);
  const disposers = [];

  root.innerHTML = `
    <div class="chip-scroll" id="periods">${PERIODS.map(([k, l]) => `<button class="chip-btn" data-k="${k}">${l}</button>`).join('')}</div>
    <form class="custom-range card" id="custom" hidden>
      <label class="field"><span class="field-label">Dari</span><input type="date" name="start" value="${range.start}"></label>
      <label class="field"><span class="field-label">Sampai</span><input type="date" name="end" value="${range.end}"></label>
      <button class="btn btn-primary" type="submit">Tampilkan</button>
    </form>
    <h2 class="period-title" id="ptitle"></h2>
    <div id="rep-body"></div>`;

  const body = $('#rep-body', root);

  async function load() {
    disposers.splice(0).forEach((d) => d());
    root.querySelectorAll('#periods [data-k]').forEach((b) => b.classList.toggle('active', b.dataset.k === key));
    $('#custom', root).hidden = key !== 'custom';
    $('#ptitle', root).textContent = periodLabel(range.start, range.end);
    body.innerHTML = loadingHTML('Menghitung laporan…');
    try {
      const [s, series, bal] = await Promise.all([
        api.summary(range.start, range.end), api.dailySeries(range.start, range.end), api.balance(range.end),
      ]);
      s.balance_end = bal.balance;
      body.innerHTML = view(s, series);
      if (series.length > 1) {
        disposers.push(barChart($('#chart-rev', root), {
          data: series, xKey: 'day', title: 'Pendapatan jasa dan pengeluaran per hari',
          series: [{ key: 'service_revenue', label: 'Pendapatan jasa', color: C_REVENUE },
                   { key: 'expense_total', label: 'Pengeluaran', color: C_EXPENSE }],
        }));
        disposers.push(barChart($('#chart-profit', root), {
          data: series, xKey: 'day', title: 'Keuntungan bersih per hari',
          series: [{ key: 'net_profit', label: 'Keuntungan bersih', color: C_REVENUE, negColor: C_LOSS }],
        }));
      }
      bindExports(s, series);
    } catch (e) {
      body.innerHTML = errorHTML(e.message);
      body.querySelector('[data-retry]')?.addEventListener('click', load);
    }
  }

  function view(s, series) {
    const multi = series.length > 1;
    const totalRev = s.service_revenue + s.expense_total || 1;
    return `
      <section class="card hero">
        <div class="hero-top">
          <span class="hero-label">Keuntungan bersih</span>
          <span class="hero-value ${s.net_profit < 0 ? 'neg' : ''}">${rupiah(s.net_profit)}</span>
          <span class="hero-sub">Pendapatan jasa − pengeluaran operasional</span>
        </div>
        <div class="compare">
          <div class="compare-bar"><span style="width:${(s.service_revenue / totalRev * 100).toFixed(1)}%;background:${C_REVENUE}"></span><span style="width:${(s.expense_total / totalRev * 100).toFixed(1)}%;background:${C_EXPENSE}"></span></div>
          <div class="compare-legend"><span><i style="background:${C_REVENUE}"></i>Pendapatan ${rupiah(s.service_revenue)}</span><span><i style="background:${C_EXPENSE}"></i>Pengeluaran ${rupiah(s.expense_total)}</span></div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">Ringkasan keuangan</h3>
        <dl class="kv">
          <div><dt>Jumlah transaksi</dt><dd>${s.order_count}${s.cancelled_count ? ` <small class="muted">(+${s.cancelled_count} batal)</small>` : ''}</dd></div>
          <div><dt>Total nilai transaksi</dt><dd>${rupiah(s.total_value)}</dd></div>
          <div><dt>Total uang diterima</dt><dd>${rupiah(s.cash_in)}</dd></div>
          <div><dt>Total piutang</dt><dd class="${s.receivables ? 'warn' : ''}">${rupiah(s.receivables)}</dd></div>
          <div><dt>Total dana titipan <small>(belanja pelanggan)</small></dt><dd>${rupiah(s.trust_funds)}</dd></div>
          <div><dt>Total pendapatan jasa</dt><dd>${rupiah(s.service_revenue)}</dd></div>
          <div><dt>Total pengeluaran</dt><dd class="neg">${rupiah(s.expense_total)}</dd></div>
          <div class="kv-strong"><dt>Keuntungan bersih</dt><dd class="${s.net_profit < 0 ? 'neg' : 'pos'}">${rupiah(s.net_profit)}</dd></div>
          <div class="kv-strong"><dt>Saldo usaha akhir periode</dt><dd class="${s.balance_end < 0 ? 'neg' : ''}">${rupiah(s.balance_end)}</dd></div>
        </dl>
        ${s.pending_revenue ? `<p class="field-hint">${icon('info')} Ada pendapatan jasa ${rupiah(s.pending_revenue)} dari ${s.open_count} order yang belum selesai — belum dihitung sampai status Selesai.</p>` : ''}
      </section>

      ${multi ? `
      <section class="card">
        <h3 class="card-title">Pendapatan jasa vs pengeluaran per hari</h3>
        <div id="chart-rev"></div>
      </section>
      <section class="card">
        <h3 class="card-title">Keuntungan bersih per hari</h3>
        <div id="chart-profit"></div>
      </section>
      <section class="card">
        <details class="more"><summary>${icon('list')} Tabel harian</summary>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Tanggal</th><th>Order</th><th>Pendapatan jasa</th><th>Pengeluaran</th><th>Laba bersih</th></tr></thead>
            <tbody>${series.filter((d) => d.order_count || d.expense_total || d.service_revenue).map((d) => `<tr>
              <td>${formatDateShort(d.day)}</td><td>${d.order_count}</td><td>${rupiah(d.service_revenue)}</td>
              <td>${rupiah(d.expense_total)}</td><td class="${d.net_profit < 0 ? 'neg' : ''}">${rupiah(d.net_profit)}</td></tr>`).join('')
              || '<tr><td colspan="5" class="muted">Tidak ada data.</td></tr>'}</tbody>
          </table></div>
        </details>
      </section>` : ''}

      <div class="grid-2-md">
        <section class="card">
          <h3 class="card-title">Pendapatan per layanan</h3>
          ${s.by_service.length ? `<ul class="bar-list">${s.by_service.map((x) => barRow(x.service, x.revenue, s.service_revenue, `${x.count} order`, C_REVENUE)).join('')}</ul>` : '<p class="muted small">Belum ada data.</p>'}
        </section>
        <section class="card">
          <h3 class="card-title">Pengeluaran per kategori</h3>
          ${s.expenses_by_category.length ? `<ul class="bar-list">${s.expenses_by_category.map((x) => barRow(x.category, x.total, s.expense_total, `${x.count}×`, C_EXPENSE)).join('')}</ul>` : '<p class="muted small">Belum ada pengeluaran.</p>'}
        </section>
      </div>

      <section class="card">
        <h3 class="card-title">${icon('download')} Export CSV <small class="muted">(Excel / Google Sheets)</small></h3>
        <div class="action-grid action-grid-3">
          <button class="btn btn-ghost" data-exp="orders">Transaksi</button>
          <button class="btn btn-ghost" data-exp="expenses">Pengeluaran</button>
          <button class="btn btn-ghost" data-exp="report">Laporan keuangan</button>
        </div>
      </section>`;
  }

  function barRow(label, value, total, sub, color) {
    const pct = total > 0 ? Math.max(0, (value / total) * 100) : 0;
    return `<li><div class="bl-top"><span>${esc(label)} <small class="muted">${esc(sub)}</small></span><b>${rupiah(value)}</b></div>
      <div class="bl-track"><span style="width:${pct.toFixed(1)}%;background:${color}"></span></div></li>`;
  }

  function bindExports(s, series) {
    const tag = `${range.start}_${range.end}`;
    body.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', () => withBusy(b, async () => {
      try {
        if (b.dataset.exp === 'orders') {
          const rows = await api.ordersForRange(range.start, range.end);
          downloadCSV(`transaksi_${tag}.csv`, [
            ['No Nota', 'Tanggal', 'Pelanggan', 'No WhatsApp', 'Layanan', 'Keterangan', 'Jemput', 'Tujuan', 'Jarak (km)',
              'Total Barang', 'Ongkos Jasa', 'Biaya Tambahan', 'Biaya Tambahan = Pendapatan', 'Diskon', 'Total Tagihan',
              'Dibayar', 'Sisa', 'Pendapatan Jasa', 'Dana Titipan', 'Metode Bayar', 'Status Bayar', 'Status Transaksi', 'Catatan'],
            ...rows.map((o) => [o.invoice_number, o.transaction_date, o.customer_name, o.customer_phone, o.service_name,
              o.description, o.pickup_location, o.destination, o.distance ?? '', o.goods_total, o.service_fee,
              o.additional_fee, o.additional_fee_is_revenue ? 'Ya' : 'Tidak', o.discount, o.total_amount, o.paid_amount,
              o.remaining_amount, o.service_revenue, o.trust_amount, o.payment_method, o.payment_status, o.order_status, o.notes]),
          ]);
        } else if (b.dataset.exp === 'expenses') {
          const rows = await api.expensesForRange(range.start, range.end);
          downloadCSV(`pengeluaran_${tag}.csv`, [
            ['Tanggal', 'Kategori', 'Keterangan', 'Nominal', 'Metode Bayar', 'Catatan'],
            ...rows.map((e) => [e.expense_date, e.category_name, e.description, e.amount, e.payment_method, e.notes]),
          ]);
        } else {
          downloadCSV(`laporan_keuangan_${tag}.csv`, [
            ['Laporan Keuangan Kang Rewang', `${range.start} s/d ${range.end}`],
            [],
            ['Keterangan', 'Nilai'],
            ['Jumlah transaksi', s.order_count],
            ['Transaksi dibatalkan (tidak dihitung)', s.cancelled_count],
            ['Total nilai transaksi', s.total_value],
            ['Total uang diterima', s.cash_in],
            ['Total piutang', s.receivables],
            ['Total dana titipan', s.trust_funds],
            ['Total pendapatan jasa', s.service_revenue],
            ['Pendapatan jasa order belum selesai', s.pending_revenue],
            ['Total pengeluaran', s.expense_total],
            ['Keuntungan bersih', s.net_profit],
            [`Saldo usaha per ${range.end}`, s.balance_end],
            [],
            ['Tanggal', 'Jumlah Order', 'Uang Masuk', 'Pendapatan Jasa', 'Pengeluaran', 'Keuntungan Bersih'],
            ...series.map((d) => [d.day, d.order_count, d.cash_in, d.service_revenue, d.expense_total, d.net_profit]),
          ]);
        }
        toast('File CSV diunduh.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    }, 'Menyiapkan…')));
  }

  root.querySelector('#periods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    key = b.dataset.k;
    if (key === 'custom') {
      root.querySelectorAll('#periods [data-k]').forEach((x) => x.classList.toggle('active', x === b));
      $('#custom', root).hidden = false;
      return;
    }
    range = periodRange(key, todayJakarta());
    load();
  });
  $('#custom', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const start = e.target.start.value; const end = e.target.end.value;
    if (!start || !end) return toast('Isi kedua tanggal.', 'error');
    if (start > end) return toast('Tanggal awal harus sebelum tanggal akhir.', 'error');
    if (daysBetween(start, end) > 400) return toast('Rentang maksimal 400 hari.', 'error');
    range = { start, end };
    load();
  });

  await load();
  return () => disposers.forEach((d) => d());
}
