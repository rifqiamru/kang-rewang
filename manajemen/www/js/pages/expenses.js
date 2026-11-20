// Pencatatan pengeluaran operasional.
import * as api from '../api.js';
import { icon } from '../icons.js';
import {
  $, $$, esc, toast, loadingHTML, errorHTML, emptyHTML, openSheet, confirmDialog,
  moneyInputHTML, bindMoneyInputs, moneyValue, withBusy, selectOptions, debounce,
} from '../ui.js';
import { rupiah, todayJakarta, formatDateFull, periodRange } from '../lib/format.js';
import { PAYMENT_METHODS } from '../lib/calc.js';

const PAGE = 50;

/** Formulir tambah/ubah pengeluaran (bottom sheet). Dipakai juga dari Dashboard. */
export function openExpenseForm(ctx, { expense = null, onSaved } = {}) {
  const e = expense || { expense_date: todayJakarta(), category_id: '', description: '', amount: 0, payment_method: 'Tunai', notes: '' };
  const cats = ctx.expenseCategories.filter((c) => c.is_active || c.id === e.category_id);
  if (!e.category_id && cats[0]) e.category_id = cats[0].id;
  const s = openSheet({
    title: expense ? 'Ubah pengeluaran' : 'Catat pengeluaran',
    content: `<form id="exp-form" class="form-stack" novalidate autocomplete="off">
      <label class="field"><span class="field-label">Tanggal <b class="req">*</b></span>
        <input type="date" name="expense_date" value="${esc(e.expense_date)}" required></label>
      <div class="field"><span class="field-label">Kategori <b class="req">*</b></span>
        <div class="chips">${cats.map((c) => `<label class="chip"><input type="radio" name="category_id" value="${c.id}" ${c.id === e.category_id ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>
      </div>
      ${moneyInputHTML({ name: 'amount', label: 'Nominal', value: e.amount, required: true })}
      <label class="field"><span class="field-label">Keterangan</span>
        <input type="text" name="description" maxlength="200" value="${esc(e.description)}" placeholder="mis. Isi bensin motor"></label>
      <label class="field"><span class="field-label">Metode pembayaran</span>
        <select name="payment_method">${selectOptions(PAYMENT_METHODS.includes(e.payment_method) ? PAYMENT_METHODS : [...PAYMENT_METHODS, e.payment_method], e.payment_method)}</select></label>
      <label class="field"><span class="field-label">Catatan tambahan</span>
        <textarea name="notes" rows="2" maxlength="500">${esc(e.notes)}</textarea></label>
      <p class="field-hint">${icon('info')} Pengeluaran operasional tidak masuk ke nota pelanggan, tetapi otomatis masuk ke rekap harian & laporan keuangan.</p>
      <div class="btn-row">
        ${expense ? `<button type="button" class="btn btn-ghost btn-danger-text" data-delete>${icon('trash')} Hapus</button>` : ''}
        <button type="submit" class="btn btn-accent">${icon('check')} Simpan</button>
      </div>
    </form>`,
  });
  const form = s.el.querySelector('#exp-form');
  bindMoneyInputs(form);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const row = {
      expense_date: form.expense_date.value,
      category_id: form.querySelector('[name=category_id]:checked')?.value,
      amount: moneyValue(form.amount),
      description: form.description.value.trim(),
      payment_method: form.payment_method.value,
      notes: form.notes.value.trim(),
    };
    if (!row.expense_date) return toast('Tanggal wajib diisi.', 'error');
    if (!row.category_id) return toast('Pilih kategori pengeluaran.', 'error');
    if (!(row.amount > 0)) return toast('Nominal harus lebih dari Rp0.', 'error');
    if (expense) row.id = expense.id;
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        await api.saveExpense(row);
        toast(expense ? 'Pengeluaran diperbarui.' : `Pengeluaran ${rupiah(row.amount)} tercatat.`, 'success');
        s.close();
        onSaved?.();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  form.querySelector('[data-delete]')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const ok = await confirmDialog({
      title: 'Hapus pengeluaran?',
      message: `Pengeluaran <b>${esc(expense.category_name || '')} ${rupiah(expense.amount)}</b> akan dihapus permanen dan laporan ikut diperbarui.`,
      okText: 'Hapus permanen', danger: true,
    });
    if (!ok) return;
    await withBusy(btn, async () => {
      try {
        await api.deleteExpense(expense.id);
        toast('Pengeluaran dihapus.', 'success');
        s.close();
        onSaved?.();
      } catch (err) { toast(err.message, 'error'); }
    }, 'Menghapus…');
  });
}

export async function render(root, _params, ctx) {
  const f = { q: '', start: '', end: '', category: '' };
  let offset = 0;
  let rows = [];
  root.innerHTML = `
    <div class="totals-row" id="totals">${loadingHTML()}</div>
    <button class="btn btn-accent btn-block btn-lg" id="btn-add">${icon('plus')} Catat Pengeluaran</button>
    <div class="search-bar">
      <label class="search">${icon('search')}<input type="search" id="q" placeholder="Cari keterangan" enterkeyhint="search"></label>
    </div>
    <div class="filter-inline">
      <select id="f-cat" aria-label="Filter kategori">${selectOptions(ctx.expenseCategories, '', { valueKey: 'id', labelKey: 'name', placeholder: 'Semua kategori' })}</select>
      <input type="date" id="f-start" aria-label="Dari tanggal">
      <input type="date" id="f-end" aria-label="Sampai tanggal">
    </div>
    <div id="list"></div>
    <div id="more"></div>`;

  const listEl = $('#list', root);

  async function loadTotals() {
    const t = todayJakarta();
    const w = periodRange('week', t); const m = periodRange('month', t);
    try {
      const [a, b, c] = await Promise.all([api.summary(t, t), api.summary(w.start, w.end), api.summary(m.start, m.end)]);
      $('#totals', root).innerHTML = [['Hari ini', a], ['Minggu ini', b], ['Bulan ini', c]].map(([l, s]) =>
        `<div class="total-box"><small>${l}</small><b>${rupiah(s.expense_total)}</b></div>`).join('');
    } catch (e) {
      $('#totals', root).innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
    }
  }

  async function reload() {
    offset = 0; rows = [];
    listEl.innerHTML = loadingHTML();
    $('#more', root).innerHTML = '';
    await loadMore();
  }

  async function loadMore() {
    try {
      const res = await api.listExpenses({ ...f, limit: PAGE, offset });
      rows = rows.concat(res.rows);
      offset += PAGE;
      if (!rows.length) {
        listEl.innerHTML = emptyHTML(f.q || f.category || f.start || f.end ? 'Tidak ada pengeluaran yang cocok.' : 'Belum ada pengeluaran tercatat.');
      } else {
        // Kelompokkan per tanggal dengan subtotal harian
        const groups = new Map();
        for (const r of rows) {
          if (!groups.has(r.expense_date)) groups.set(r.expense_date, []);
          groups.get(r.expense_date).push(r);
        }
        listEl.innerHTML = [...groups.entries()].map(([d, list]) => `
          <section class="group">
            <header class="group-head"><span>${formatDateFull(d)}</span><b>${rupiah(list.reduce((s, x) => s + x.amount, 0))}</b></header>
            <ul class="mini-list card">${list.map((x) => `
              <li><button class="ml-btn" data-id="${x.id}"><span><b>${esc(x.category_name)}</b>${x.description ? ' · ' + esc(x.description) : ''}
                <small>${esc(x.payment_method)}${x.notes ? ' · ' + esc(x.notes) : ''}</small></span>
                <span class="ml-side"><b class="neg">−${rupiah(x.amount)}</b></span></button></li>`).join('')}</ul>
          </section>`).join('');
      }
      const hasMore = rows.length < res.count;
      $('#more', root).innerHTML = hasMore ? '<button class="btn btn-ghost btn-block" id="btn-more">Muat lebih banyak</button>' : '';
      $('#btn-more', root)?.addEventListener('click', (e) => withBusy(e.currentTarget, loadMore, 'Memuat…'));
    } catch (e) {
      listEl.innerHTML = errorHTML(e.message);
      listEl.querySelector('[data-retry]')?.addEventListener('click', reload);
    }
  }

  const refreshAll = () => { loadTotals(); reload(); };
  $('#btn-add', root).onclick = () => openExpenseForm(ctx, { onSaved: refreshAll });
  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const exp = rows.find((r) => r.id === b.dataset.id);
    if (exp) openExpenseForm(ctx, { expense: exp, onSaved: refreshAll });
  });
  $('#q', root).addEventListener('input', debounce((e) => { f.q = e.target.value.trim(); reload(); }, 350));
  $('#f-cat', root).addEventListener('change', (e) => { f.category = e.target.value; reload(); });
  $$('#f-start, #f-end', root).forEach((el) => el.addEventListener('change', () => {
    f.start = $('#f-start', root).value; f.end = $('#f-end', root).value; reload();
  }));
  await Promise.all([loadTotals(), reload()]);
}
