// Buat Nota / Ubah / Duplikasi transaksi, dan layar hasil nota.
import * as api from '../api.js';
import { icon } from '../icons.js';
import {
  $, $$, esc, toast, loadingHTML, errorHTML, moneyInputHTML, bindMoneyInputs, moneyValue,
  withBusy, copyText, openWhatsApp, uuid, confirmDialog, badge, selectOptions, debounce,
} from '../ui.js';
import {
  rupiah, todayJakarta, formatNumber, parseQuantity, formatQuantity, cleanPhone, isValidPhone,
} from '../lib/format.js';
import { computeOrder, itemSubtotal, PAYMENT_STATUSES, ORDER_STATUSES, PAYMENT_METHODS } from '../lib/calc.js';
import { buildNotaText } from '../lib/templates.js';
import { downloadNotaPDF, shareNotaPDF, openNotaPDF } from '../lib/pdf.js';
import { draftKey, loadDraft, saveDraft, clearDraft, hasMeaningfulContent } from '../lib/drafts.js';

const EMPTY_ITEM = () => ({ item_name: '', quantity: 1, unit_price: 0 });

function emptyForm() {
  return {
    transaction_date: todayJakarta(),
    customer_name: '', customer_phone: '',
    service_category_id: '', description: '',
    shipping_address: '', courier: '', tracking_number: '',
    items: [EMPTY_ITEM()],
    shipping_fee: 0, additional_fee: 0, additional_fee_is_revenue: true, discount: 0,
    // Penjualan di toko umumnya langsung dibayar & selesai.
    payment_method: 'Tunai', payment_status: 'Lunas', paid_amount: 0,
    order_status: 'Selesai', notes: '',
  };
}

function formFromOrder(o) {
  return {
    transaction_date: o.transaction_date,
    customer_name: o.customer_name || '', customer_phone: o.customer_phone || '',
    service_category_id: o.service_category_id || '', description: o.description || '',
    shipping_address: o.shipping_address || '', courier: o.courier || '',
    tracking_number: o.tracking_number || '',
    items: (o.items || []).map((i) => ({ item_name: i.item_name, quantity: Number(i.quantity), unit_price: i.unit_price })),
    shipping_fee: o.shipping_fee, additional_fee: o.additional_fee,
    additional_fee_is_revenue: o.additional_fee_is_revenue !== false, discount: o.discount,
    payment_method: o.payment_method || 'Tunai', payment_status: o.payment_status,
    paid_amount: o.paid_amount, order_status: o.order_status, notes: o.notes || '',
  };
}

export async function render(root, params, ctx) {
  if (params.mode === 'result') return renderResult(root, params.id, ctx);

  const key = draftKey(params.mode === 'edit' ? 'edit' : 'new', params.id);
  let draft = loadDraft(key);
  let form; let requestId; let original = null; let restored = false;

  if (params.mode === 'edit') {
    root.innerHTML = loadingHTML('Memuat transaksi…');
    try { original = await api.getOrder(params.id); } catch (e) { root.innerHTML = errorHTML(e.message, false); return; }
    if (!original) { root.innerHTML = errorHTML('Transaksi tidak ditemukan.', false); return; }
    if (draft?.form && draft.updated_at === original.updated_at) { form = draft.form; restored = true; }
    else form = formFromOrder(original);
  } else if (params.mode === 'dup') {
    root.innerHTML = loadingHTML('Menyiapkan duplikasi…');
    let src;
    try { src = await api.getOrder(params.id); } catch (e) { root.innerHTML = errorHTML(e.message, false); return; }
    if (!src) { root.innerHTML = errorHTML('Transaksi sumber tidak ditemukan.', false); return; }
    if (draft && hasMeaningfulContent(draft)) {
      const ok = await confirmDialog({
        title: 'Ganti draft yang ada?',
        message: 'Anda masih punya draft nota yang belum disimpan. Duplikasi akan menggantinya.',
        okText: 'Ganti draft',
      });
      if (!ok) { ctx.navigate('#/nota'); return; }
    }
    form = {
      ...formFromOrder(src), transaction_date: todayJakarta(),
      payment_status: 'Belum Bayar', paid_amount: 0, order_status: 'Pesanan',
    };
    draft = null;
    clearDraft(key);
    history.replaceState(null, '', '#/nota');
  } else if (draft?.form) {
    form = draft.form;
    restored = hasMeaningfulContent(draft);
  } else {
    form = emptyForm();
  }
  requestId = params.mode === 'edit' ? null : (draft?.client_request_id || uuid());
  if (!form.items?.length) form.items = [];
  const pending = Boolean(draft?.pendingSave);

  const services = ctx.serviceCategories.filter((s) => s.is_active || s.id === form.service_category_id);
  if (!form.service_category_id && params.mode !== 'edit' && services[0] && !restored) {
    form.service_category_id = services[0].id;
  }
  const isEdit = params.mode === 'edit';

  root.innerHTML = `
    ${pending ? `<div class="card notice notice-warn">${icon('cloudOff')}<div><b>Nota ini BELUM tersimpan ke server</b>
      <p>Penyimpanan sebelumnya gagal karena koneksi. Nota akan dikirim otomatis saat online, atau tekan Simpan lagi.</p></div></div>` : ''}
    ${restored && !pending ? `<div class="card notice notice-info">${icon('info')}<div><b>Draft dipulihkan</b>
      <p>Isian terakhir Anda dikembalikan.</p><button type="button" class="btn btn-link btn-sm" id="btn-reset">Kosongkan formulir</button></div></div>` : ''}
    <form id="nota-form" class="form-stack" novalidate autocomplete="off">
      <section class="card">
        <div class="card-head">
          <h3 class="card-title">${icon('receipt')} Informasi transaksi</h3>
          <span class="inv-chip">${isEdit ? esc(original.invoice_number) : 'No. nota otomatis'}</span>
        </div>
        <div class="grid-2">
          <label class="field"><span class="field-label">Tanggal <b class="req">*</b></span>
            <input type="date" name="transaction_date" value="${esc(form.transaction_date)}" required></label>
          <label class="field"><span class="field-label">No. WhatsApp</span>
            <input type="tel" name="customer_phone" inputmode="tel" value="${esc(form.customer_phone)}" placeholder="08xxxxxxxxxx"></label>
        </div>
        <label class="field"><span class="field-label">Nama pelanggan</span>
          <input type="text" name="customer_name" value="${esc(form.customer_name)}" maxlength="100" placeholder="Boleh dikosongkan" autocapitalize="words"></label>
        <div class="field"><span class="field-label">Kategori penjualan <b class="req">*</b></span>
          <div class="chips" role="radiogroup">
            ${services.map((s) => `<label class="chip"><input type="radio" name="service_category_id" value="${s.id}"
              ${s.id === form.service_category_id ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}
          </div>
        </div>
        <label class="field"><span class="field-label">Keterangan <small>(tampil di nota)</small></span>
          <input type="text" name="description" value="${esc(form.description)}" maxlength="500" placeholder="mis. Pesanan seragam arisan"></label>
        <details class="more" ${form.shipping_address || form.courier || form.tracking_number ? 'open' : ''}>
          <summary>${icon('truck')} Alamat & pengiriman <small>(opsional)</small></summary>
          <label class="field"><span class="field-label">Alamat pelanggan / alamat kirim <small>(tampil di nota PDF)</small></span>
            <textarea name="shipping_address" rows="2" maxlength="300" placeholder="Jalan, kelurahan, kota">${esc(form.shipping_address)}</textarea></label>
          <div class="grid-2">
            <label class="field"><span class="field-label">Kurir / ekspedisi</span>
              <input type="text" name="courier" value="${esc(form.courier)}" maxlength="60" placeholder="mis. JNE REG" list="courier-list"></label>
            <label class="field"><span class="field-label">No. resi</span>
              <input type="text" name="tracking_number" value="${esc(form.tracking_number)}" maxlength="60" autocapitalize="characters"></label>
          </div>
          <datalist id="courier-list">${['JNE', 'J&T', 'SiCepat', 'AnterAja', 'Pos Indonesia', 'TIKI', 'Ninja Xpress', 'GoSend', 'GrabExpress', 'Kurir toko', 'Ambil di toko'].map((c) => `<option value="${c}">`).join('')}</datalist>
        </details>
      </section>

      <section class="card">
        <div class="card-head">
          <h3 class="card-title">${icon('clipboard')} Rincian barang</h3>
          <span class="muted small" id="goods-total"></span>
        </div>
        <div id="items"></div>
        <button type="button" class="btn btn-ghost btn-block" id="btn-add-item">${icon('plus')} Tambah barang</button>
      </section>

      <section class="card">
        <h3 class="card-title">${icon('wallet')} Biaya</h3>
        ${moneyInputHTML({ name: 'shipping_fee', label: 'Ongkos kirim', value: form.shipping_fee, hint: 'Diteruskan ke ekspedisi — tidak dihitung sebagai pendapatan.' })}
        <div class="grid-2">
          ${moneyInputHTML({ name: 'additional_fee', label: 'Biaya tambahan', value: form.additional_fee })}
          ${moneyInputHTML({ name: 'discount', label: 'Diskon', value: form.discount })}
        </div>
        <label class="switch" id="addl-switch" ${Number(form.additional_fee) ? '' : 'hidden'}>
          <input type="checkbox" name="additional_fee_is_revenue" ${form.additional_fee_is_revenue ? 'checked' : ''}>
          <span class="switch-ui"></span>
          <span>Biaya tambahan termasuk <b>pendapatan penjualan</b>
            <small>Mis. biaya jahit/permak/kemasan khusus. Matikan jika hanya penggantian biaya yang diteruskan ke pihak lain.</small></span>
        </label>
        <div class="calc-box" id="calc-box"></div>
      </section>

      <section class="card">
        <h3 class="card-title">${icon('check')} Pembayaran & status</h3>
        <div class="field"><span class="field-label">Status pembayaran</span>
          <div class="seg">${PAYMENT_STATUSES.map((s) => `<label><input type="radio" name="payment_status" value="${s}" ${s === form.payment_status ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div>
        </div>
        <div id="dp-wrap" ${form.payment_status === 'DP' ? '' : 'hidden'}>
          ${moneyInputHTML({ name: 'paid_amount', label: 'Nominal DP', value: form.payment_status === 'DP' ? form.paid_amount : 0 })}
        </div>
        <label class="field"><span class="field-label">Metode pembayaran</span>
          <select name="payment_method">${selectOptions(PAYMENT_METHODS.includes(form.payment_method) ? PAYMENT_METHODS : [...PAYMENT_METHODS, form.payment_method], form.payment_method)}</select></label>
        <div class="field"><span class="field-label">Status transaksi</span>
          <div class="seg seg-wrap">${ORDER_STATUSES.map((s) => `<label><input type="radio" name="order_status" value="${s}" ${s === form.order_status ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div>
        </div>
        <p class="field-hint" id="status-hint"></p>
        <label class="field"><span class="field-label">Catatan internal <small>(tidak tampil di nota)</small></span>
          <textarea name="notes" rows="2" maxlength="1000">${esc(form.notes)}</textarea></label>
      </section>

      <div class="save-bar">
        <div class="save-total"><small>Total tagihan</small><b id="bar-total">Rp0</b></div>
        <button type="submit" class="btn btn-accent btn-lg" id="btn-save">${icon('check')} ${isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
      </div>
    </form>`;

  const formEl = $('#nota-form', root);
  const itemsEl = $('#items', root);
  bindMoneyInputs(formEl);

  function renderItems() {
    if (!form.items.length) {
      itemsEl.innerHTML = `<p class="muted small no-items">Belum ada barang. Tekan <b>Tambah barang</b> untuk mengisi produk yang dibeli.</p>`;
      return;
    }
    itemsEl.innerHTML = form.items.map((it, i) => `
      <div class="item-row" data-i="${i}">
        <div class="item-top">
          <span class="item-no">${i + 1}</span>
          <input type="text" class="item-name" data-f="item_name" value="${esc(it.item_name)}" placeholder="Nama barang (mis. Kemeja batik tulis L)" maxlength="150" aria-label="Nama barang ${i + 1}">
          <button type="button" class="icon-btn icon-btn-danger" data-del="${i}" aria-label="Hapus barang ${i + 1}">${icon('trash')}</button>
        </div>
        <div class="item-bottom">
          <input type="text" inputmode="decimal" class="item-qty" data-f="quantity" value="${esc(formatQuantity(it.quantity))}" aria-label="Jumlah">
          <span class="times">×</span>
          <span class="money money-sm"><span class="money-prefix">Rp</span>
            <input type="text" inputmode="numeric" data-money data-f="unit_price" value="${it.unit_price ? formatNumber(it.unit_price) : ''}" placeholder="Harga satuan" aria-label="Harga satuan"></span>
          <span class="item-sub" data-sub>${rupiah(itemSubtotal(it.quantity, it.unit_price))}</span>
        </div>
      </div>`).join('');
  }

  function readForm() {
    const fd = new FormData(formEl);
    const g = (k) => String(fd.get(k) ?? '').trim();
    form.transaction_date = g('transaction_date');
    form.customer_name = g('customer_name');
    form.customer_phone = g('customer_phone');
    form.service_category_id = g('service_category_id');
    form.description = g('description');
    form.shipping_address = g('shipping_address');
    form.courier = g('courier');
    form.tracking_number = g('tracking_number');
    form.shipping_fee = moneyValue(formEl.shipping_fee);
    form.additional_fee = moneyValue(formEl.additional_fee);
    form.discount = moneyValue(formEl.discount);
    form.additional_fee_is_revenue = formEl.additional_fee_is_revenue.checked;
    form.payment_status = g('payment_status') || 'Belum Bayar';
    form.paid_amount = moneyValue(formEl.paid_amount);
    form.payment_method = g('payment_method');
    form.order_status = g('order_status') || 'Pesanan';
    form.notes = g('notes');
    form.items = $$('.item-row', itemsEl).map((row) => ({
      item_name: $('[data-f=item_name]', row).value.trim(),
      quantity: parseQuantity($('[data-f=quantity]', row).value),
      unit_price: moneyValue($('[data-f=unit_price]', row)),
    }));
  }

  /** Item kosong (tanpa nama & harga) diabaikan saat menyimpan. */
  const usedItems = () => form.items.filter((it) => it.item_name || it.unit_price);

  function update() {
    readForm();
    const c = computeOrder({ ...form, items: usedItems() });
    $$('.item-row', itemsEl).forEach((row, i) => {
      const it = form.items[i];
      $('[data-sub]', row).textContent = rupiah(itemSubtotal(it.quantity, it.unit_price));
    });
    $('#goods-total', root).textContent = c.goods_total ? `Total barang ${rupiah(c.goods_total)}` : '';
    $('#dp-wrap', root).hidden = form.payment_status !== 'DP';
    $('#addl-switch', root).hidden = !form.additional_fee;
    $('#bar-total', root).textContent = rupiah(c.total_amount);
    $('#calc-box', root).innerHTML = `
      <div class="calc-line"><span>Total harga barang</span><span>${rupiah(c.goods_total)}</span></div>
      ${form.shipping_fee ? `<div class="calc-line"><span>Ongkos kirim</span><span>${rupiah(form.shipping_fee)}</span></div>` : ''}
      ${form.additional_fee ? `<div class="calc-line"><span>Biaya tambahan</span><span>${rupiah(form.additional_fee)}</span></div>` : ''}
      ${form.discount ? `<div class="calc-line"><span>Diskon</span><span>−${rupiah(form.discount)}</span></div>` : ''}
      <div class="calc-line calc-total"><span>Total tagihan</span><span>${rupiah(c.total_amount)}</span></div>
      ${form.payment_status === 'DP' ? `<div class="calc-line"><span>DP diterima</span><span>${rupiah(c.paid_amount)}</span></div>
        <div class="calc-line calc-warn"><span>Sisa pembayaran</span><span>${rupiah(c.remaining_amount)}</span></div>` : ''}
      <div class="calc-split">
        <div><small>Pendapatan penjualan</small><b>${rupiah(c.sales_revenue)}</b></div>
        <div><small>Ongkir & titipan</small><b>${rupiah(c.trust_amount)}</b></div>
      </div>`;
    const hint = $('#status-hint', root);
    hint.textContent = form.order_status === 'Selesai'
      ? 'Pendapatan penjualan dihitung ke laporan karena status Selesai.'
      : form.order_status === 'Dibatalkan'
        ? 'Transaksi dibatalkan tidak dihitung sebagai pendapatan, tetapi riwayatnya tetap tersimpan.'
        : 'Pendapatan penjualan baru dihitung ke laporan setelah status Selesai.';
    persist();
  }

  let done = false; // true setelah tersimpan ke server → jangan tulis draft lagi
  let initialJSON = null; // isian awal; draft hanya ditulis jika ada perubahan
  const writeDraft = () => {
    if (done || pending) return;
    if (!restored && JSON.stringify(form) === initialJSON) { clearDraft(key); return; }
    saveDraft(key, {
      form, client_request_id: requestId, mode: params.mode, id: params.id,
      updated_at: original?.updated_at, pendingSave: false,
    });
  };
  const persist = debounce(writeDraft, 400);

  renderItems();
  update();
  initialJSON = JSON.stringify(form);

  formEl.addEventListener('input', update);
  formEl.addEventListener('change', update);
  $('#btn-add-item', root).addEventListener('click', () => {
    readForm();
    form.items.push(EMPTY_ITEM());
    renderItems();
    update();
    const rows = $$('.item-name', itemsEl);
    rows[rows.length - 1]?.focus();
  });
  itemsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    readForm();
    form.items.splice(Number(b.dataset.del), 1);
    renderItems();
    update();
  });
  $('#btn-reset', root)?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Kosongkan formulir?', message: 'Semua isian draft akan dihapus.', okText: 'Kosongkan', danger: true });
    if (!ok) return;
    clearDraft(key);
    ctx.navigate(isEdit ? `#/nota/ubah/${params.id}` : '#/nota');
  });

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    readForm();
    const items = usedItems();
    const c = computeOrder({ ...form, items });
    const errors = [...c.errors];
    if (!form.transaction_date) errors.unshift('Tanggal transaksi wajib diisi.');
    if (!form.service_category_id) errors.unshift('Pilih kategori penjualan.');
    if (!isValidPhone(form.customer_phone)) errors.push('Nomor WhatsApp tidak valid (8–15 angka).');
    if (c.total_amount <= 0 && form.order_status !== 'Dibatalkan') errors.push('Total tagihan masih Rp0. Isi barang yang dibeli.');
    if (errors.length) { toast(errors[0], 'error'); return; }

    const payload = {
      ...form,
      items,
      customer_phone: cleanPhone(form.customer_phone),
      paid_amount: c.paid_amount,
    };
    if (isEdit) payload.id = params.id; else payload.client_request_id = requestId;

    await withBusy($('#btn-save', root), async () => {
      try {
        const saved = await api.saveOrder(payload);
        done = true;
        clearDraft(key);
        if (saved._duplicate) toast(`Nota ${saved.invoice_number} sudah tersimpan sebelumnya — tidak dibuat ganda.`, 'info', 5000);
        else toast(isEdit ? 'Perubahan tersimpan. Rekap & laporan ikut diperbarui.' : `Transaksi ${saved.invoice_number} tersimpan.`, 'success');
        ctx.navigate(isEdit ? `#/order/${saved.id}` : `#/nota/hasil/${saved.id}`);
      } catch (err) {
        if (err.offline) {
          done = true; // draft tertunda ditulis langsung di bawah
          saveDraft(key, { form, client_request_id: requestId, mode: params.mode, id: params.id,
            updated_at: original?.updated_at, pendingSave: true, payload });
          toast('Tidak ada koneksi. Nota BELUM tersimpan. Draft disimpan di HP ini dan akan dikirim otomatis saat online.', 'error', 7000);
        } else {
          toast(err.message, 'error');
        }
      }
    });
  });

  return () => { if (!done) { readForm(); writeDraft(); } };
}

// ------------------------------------------------------------ Layar hasil
async function renderResult(root, id, ctx) {
  root.innerHTML = loadingHTML('Memuat nota…');
  let order;
  try { order = await api.getOrder(id); } catch (e) { root.innerHTML = errorHTML(e.message, false); return; }
  if (!order) { root.innerHTML = errorHTML('Transaksi tidak ditemukan.', false); return; }
  const text = buildNotaText(order, ctx.settings);
  root.innerHTML = `
    <section class="card success-head">
      <span class="success-ic">${icon('check')}</span>
      <div><h2>Transaksi tersimpan</h2>
        <p><b>${esc(order.invoice_number)}</b> · ${rupiah(order.total_amount)} ${badge(order.payment_status)} ${badge(order.order_status)}</p></div>
    </section>
    ${pdfActionsHTML()}
    <div class="action-grid">
      <button class="btn btn-primary" id="btn-copy">${icon('copy')} Salin Teks Nota</button>
      <button class="btn btn-wa" id="btn-wa">${icon('whatsapp')} Kirim Teks ke WhatsApp</button>
      <a class="btn btn-ghost" href="#/order/${order.id}">${icon('eye')} Lihat Detail Transaksi</a>
      <a class="btn btn-accent" href="#/nota">${icon('plus')} Buat Nota Baru</a>
    </div>
    <section class="card">
      <h3 class="card-title">Pratinjau nota WhatsApp</h3>
      <pre class="wa-preview">${esc(text)}</pre>
    </section>`;
  $('#btn-copy', root).onclick = () => copyText(text);
  $('#btn-wa', root).onclick = () => openWhatsApp(text, order.customer_phone);
  bindPdfActions(root, order, ctx);
}

// ------------------------------------------------------------ Nota PDF berkop
export function pdfActionsHTML() {
  return `<section class="card pdf-card">
      <div class="pdf-head">${icon('file')}<div><b>Nota PDF berkop</b><small>Siap dicetak atau dikirim ke pelanggan</small></div></div>
      <div class="action-grid action-grid-3">
        <button class="btn btn-accent" data-pdf="share">${icon('share')} Bagikan PDF</button>
        <button class="btn btn-ghost" data-pdf="download">${icon('download')} Unduh PDF</button>
        <button class="btn btn-ghost" data-pdf="open">${icon('eye')} Lihat / Cetak</button>
      </div>
    </section>`;
}

export function bindPdfActions(root, order, ctx) {
  root.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => withBusy(b, async () => {
    try {
      const kind = b.dataset.pdf;
      if (kind === 'share') {
        const r = await shareNotaPDF(order, ctx.settings);
        if (r === 'downloaded') toast('Perangkat tidak mendukung berbagi file — PDF diunduh. Kirim lewat WhatsApp dari folder Download.', 'info', 6000);
        else if (r === 'shared') toast('Nota PDF dibagikan.', 'success');
      } else if (kind === 'download') {
        await downloadNotaPDF(order, ctx.settings);
        toast('Nota PDF diunduh.', 'success');
      } else {
        await openNotaPDF(order, ctx.settings);
      }
    } catch (e) {
      toast(e.message || 'Gagal membuat PDF.', 'error');
    }
  }, 'Membuat PDF…')));
}
