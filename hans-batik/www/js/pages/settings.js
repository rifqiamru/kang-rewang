// Pengaturan: identitas usaha, info pembayaran, kategori, nomor nota, tampilan, akun.
import * as api from '../api.js';
import { icon } from '../icons.js';
import { $, esc, toast, withBusy, openSheet, confirmDialog, moneyInputHTML, bindMoneyInputs, moneyValue } from '../ui.js';
import { todayJakarta, isValidPhone, cleanPhone, rupiah } from '../lib/format.js';
import { getPref, setPref } from '../lib/drafts.js';
import { buildNotaText } from '../lib/templates.js';
import { openNotaPDF } from '../lib/pdf.js';

export async function render(root, _params, ctx) {
  const s = ctx.settings;
  const biz = s.business; const pay = s.payment; const inv = s.invoice;
  const kop = s.letterhead || {};
  let logo = kop.logo || '';
  const bal = s.balance || { opening_amount: 0, start_date: null };
  const yymm = todayJakarta().slice(2, 4) + todayJakarta().slice(5, 7);

  root.innerHTML = `
    <nav class="chip-scroll set-nav">
      <a class="chip-btn" href="#set-usaha">Usaha</a><a class="chip-btn" href="#set-kop">Kop nota PDF</a><a class="chip-btn" href="#set-bayar">Pembayaran</a><a class="chip-btn" href="#set-saldo">Saldo</a>
      <a class="chip-btn" href="#set-layanan">Kategori penjualan</a><a class="chip-btn" href="#set-biaya">Kategori biaya</a>
      <a class="chip-btn" href="#set-nota">Nomor nota</a><a class="chip-btn" href="#set-tampilan">Tampilan</a>
      <a class="chip-btn" href="#set-akun">Akun</a>
    </nav>

    <form class="card form-stack" id="set-usaha" novalidate>
      <h3 class="card-title">${icon('user')} Identitas usaha</h3>
      <label class="field"><span class="field-label">Nama usaha</span><input name="name" maxlength="60" value="${esc(biz.name)}" required></label>
      <label class="field"><span class="field-label">Tagline</span><input name="tagline" maxlength="80" value="${esc(biz.tagline)}"></label>
      <label class="field"><span class="field-label">Nomor WhatsApp usaha</span><input name="whatsapp" type="tel" inputmode="tel" value="${esc(biz.whatsapp)}"></label>
      <label class="field"><span class="field-label">Nama pemilik</span><input name="owner_name" maxlength="80" value="${esc(biz.owner_name)}"></label>
      <label class="field"><span class="field-label">Kalimat penutup nota</span><input name="nota_footer" maxlength="120" value="${esc(biz.nota_footer)}"></label>
      <button class="btn btn-primary" type="submit">Simpan identitas</button>
    </form>

    <form class="card form-stack" id="set-kop" novalidate>
      <h3 class="card-title">${icon('file')} Kop nota PDF</h3>
      <p class="field-hint">${icon('info')} Nama usaha, tagline & no. WA diambil dari Identitas usaha. Data di bawah tampil di kop dan bagian bawah nota PDF.</p>
      <div class="logo-pick">
        <img id="logo-preview" alt="Logo kop" width="72" height="72">
        <div>
          <span class="field-label">Logo kop</span>
          <div class="btn-row">
            <label class="btn btn-ghost btn-sm">${icon('image')} Pilih logo<input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp" hidden></label>
            <button type="button" class="btn btn-link btn-sm" id="logo-reset">Pakai logo bawaan</button>
          </div>
          <small class="muted">PNG/JPG, otomatis diperkecil. Logo persegi/bulat paling bagus.</small>
        </div>
      </div>
      <label class="field"><span class="field-label">Alamat usaha</span>
        <textarea name="address" rows="2" maxlength="200" placeholder="Jalan, kecamatan, kota, kode pos">${esc(kop.address)}</textarea></label>
      <div class="grid-2">
        <label class="field"><span class="field-label">Telepon <small>(kosong = no. WA usaha)</small></span><input name="phone" type="tel" inputmode="tel" maxlength="40" value="${esc(kop.phone)}"></label>
        <label class="field"><span class="field-label">Email</span><input name="email" type="email" inputmode="email" maxlength="80" value="${esc(kop.email)}"></label>
      </div>
      <label class="field"><span class="field-label">Website / Instagram / marketplace</span><input name="website" maxlength="80" value="${esc(kop.website)}" placeholder="mis. instagram.com/hansbatik"></label>
      <div class="grid-2">
        <div class="field"><span class="field-label">Ukuran kertas</span>
          <div class="seg">${['A5', 'A4'].map((p) => `<label><input type="radio" name="paper" value="${p}" ${(kop.paper || 'A5') === p ? 'checked' : ''}><span>${p}</span></label>`).join('')}</div></div>
        <label class="field"><span class="field-label">Nama penanda tangan</span><input name="signer" maxlength="60" value="${esc(kop.signer)}" placeholder="kosong = nama pemilik"></label>
      </div>
      <label class="field"><span class="field-label">Catatan kaki nota <small>(mis. ketentuan retur)</small></span>
        <textarea name="note" rows="2" maxlength="250">${esc(kop.note)}</textarea></label>
      <div class="btn-row">
        <button class="btn btn-ghost" type="button" id="btn-kop-preview">${icon('eye')} Contoh PDF</button>
        <button class="btn btn-primary" type="submit">Simpan kop</button>
      </div>
    </form>

    <form class="card form-stack" id="set-bayar" novalidate>
      <h3 class="card-title">${icon('wallet')} Informasi pembayaran di nota</h3>
      <fieldset class="pay-block">
        <label class="switch"><input type="checkbox" name="bank_enabled" ${pay.bank?.enabled ? 'checked' : ''}><span class="switch-ui"></span><span>Tampilkan rekening bank</span></label>
        <div class="grid-2">
          <label class="field"><span class="field-label">Nama bank</span><input name="bank_name" maxlength="30" value="${esc(pay.bank?.name)}"></label>
          <label class="field"><span class="field-label">Nomor rekening</span><input name="bank_account" inputmode="numeric" maxlength="30" value="${esc(pay.bank?.account_number)}"></label>
        </div>
      </fieldset>
      <fieldset class="pay-block">
        <label class="switch"><input type="checkbox" name="dana_enabled" ${pay.dana?.enabled ? 'checked' : ''}><span class="switch-ui"></span><span>Tampilkan Dana</span></label>
        <label class="field"><span class="field-label">Nomor Dana</span><input name="dana_number" inputmode="tel" maxlength="20" value="${esc(pay.dana?.number)}"></label>
      </fieldset>
      <fieldset class="pay-block">
        <label class="switch"><input type="checkbox" name="qris_enabled" ${pay.qris?.enabled ? 'checked' : ''}><span class="switch-ui"></span><span>Tampilkan QRIS</span></label>
        <label class="field"><span class="field-label">Informasi QRIS</span><input name="qris_info" maxlength="60" value="${esc(pay.qris?.info)}"></label>
      </fieldset>
      <label class="field"><span class="field-label">Atas nama (pemilik rekening)</span><input name="account_holder" maxlength="60" value="${esc(pay.account_holder)}"></label>
      <div class="btn-row">
        <button class="btn btn-ghost" type="button" id="btn-preview">${icon('eye')} Contoh nota</button>
        <button class="btn btn-primary" type="submit">Simpan pembayaran</button>
      </div>
    </form>

    <form class="card form-stack" id="set-saldo" novalidate>
      <h3 class="card-title">${icon('wallet')} Saldo usaha</h3>
      <p class="field-hint">${icon('info')} Saldo = saldo awal + pendapatan penjualan (order Selesai) − pengeluaran. Ongkos kirim titipan tidak masuk saldo.</p>
      ${moneyInputHTML({ name: 'opening_amount', label: 'Saldo awal', value: bal.opening_amount })}
      <label class="field"><span class="field-label">Mulai dihitung sejak tanggal <small>(kosongkan = sejak transaksi pertama)</small></span>
        <input type="date" name="start_date" value="${esc(bal.start_date || '')}"></label>
      <p class="field-hint" id="saldo-now"></p>
      <button class="btn btn-primary" type="submit">Simpan saldo</button>
    </form>

    <section class="card" id="set-layanan">
      <h3 class="card-title">${icon('tag')} Kategori penjualan</h3>
      <ul class="cat-list" data-table="service_categories"></ul>
      <button class="btn btn-ghost btn-block" data-add="service_categories">${icon('plus')} Tambah kategori penjualan</button>
    </section>

    <section class="card" id="set-biaya">
      <h3 class="card-title">${icon('wallet')} Kategori pengeluaran</h3>
      <ul class="cat-list" data-table="expense_categories"></ul>
      <button class="btn btn-ghost btn-block" data-add="expense_categories">${icon('plus')} Tambah kategori</button>
    </section>

    <form class="card form-stack" id="set-nota" novalidate>
      <h3 class="card-title">${icon('receipt')} Format nomor nota</h3>
      <div class="grid-2">
        <label class="field"><span class="field-label">Kode awalan</span><input name="prefix" maxlength="6" value="${esc(inv.prefix)}" autocapitalize="characters"></label>
        <label class="field"><span class="field-label">Digit nomor urut</span>
          <select name="digits">${[2, 3, 4, 5].map((d) => `<option ${Number(inv.digits) === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      <p class="field-hint">Contoh: <b id="inv-preview"></b> — format <code>KODE-YYMM + nomor urut</code>. Nomor dibuat otomatis oleh server, unik, dan mulai dari 1 setiap bulan.</p>
      <button class="btn btn-primary" type="submit">Simpan format</button>
    </form>

    <section class="card form-stack" id="set-tampilan">
      <h3 class="card-title">${icon('eye')} Tampilan</h3>
      <div class="field"><span class="field-label">Ukuran huruf</span>
        <div class="seg">${[['normal', 'Normal'], ['besar', 'Besar']].map(([v, l]) => `<label><input type="radio" name="font" value="${v}" ${getPref('font', 'normal') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      </div>
    </section>

    <section class="card form-stack" id="set-akun">
      <h3 class="card-title">${icon('user')} Akun</h3>
      <dl class="kv"><div><dt>Email login</dt><dd>${esc(ctx.user?.email || '—')}</dd></div>
        <div><dt>Peran</dt><dd>${ctx.profile?.is_owner ? 'Pemilik' : '—'}</dd></div></dl>
      <form id="form-name" class="inline-form">
        <label class="field"><span class="field-label">Nama tampilan</span><input name="full_name" maxlength="120" value="${esc(ctx.profile?.full_name || '')}"></label>
        <button class="btn btn-ghost" type="submit">Simpan</button>
      </form>
      <form id="form-pw" class="inline-form">
        <label class="field"><span class="field-label">Password baru (min. 8 karakter)</span><input type="password" name="pw" minlength="8" autocomplete="new-password"></label>
        <button class="btn btn-ghost" type="submit">Ganti</button>
      </form>
      <button class="btn btn-ghost btn-danger-text btn-block" id="btn-logout">${icon('logout')} Keluar dari aplikasi</button>
    </section>
    <p class="muted small center">Hans Batik Management System · v1.0</p>`;

  // ---- Identitas usaha
  $('#set-usaha', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.name.value.trim()) return toast('Nama usaha wajib diisi.', 'error');
    if (!isValidPhone(f.whatsapp.value)) return toast('Nomor WhatsApp tidak valid.', 'error');
    const val = {
      name: f.name.value.trim(), tagline: f.tagline.value.trim(), whatsapp: cleanPhone(f.whatsapp.value),
      owner_name: f.owner_name.value.trim(), nota_footer: f.nota_footer.value.trim(),
    };
    await save(f.querySelector('[type=submit]'), 'business', val);
  });

  // ---- Pembayaran
  const readPay = (f) => ({
    account_holder: f.account_holder.value.trim(),
    bank: { enabled: f.bank_enabled.checked, name: f.bank_name.value.trim(), account_number: f.bank_account.value.replace(/\s/g, '') },
    dana: { enabled: f.dana_enabled.checked, number: cleanPhone(f.dana_number.value) },
    qris: { enabled: f.qris_enabled.checked, info: f.qris_info.value.trim() },
  });
  $('#set-bayar', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = readPay(e.target);
    if (val.bank.enabled && !val.bank.account_number) return toast('Isi nomor rekening atau nonaktifkan bank.', 'error');
    if (val.dana.enabled && !val.dana.number) return toast('Isi nomor Dana atau nonaktifkan Dana.', 'error');
    await save(e.target.querySelector('[type=submit]'), 'payment', val);
  });
  $('#btn-preview', root).addEventListener('click', () => {
    const preview = { ...ctx.settings, payment: readPay($('#set-bayar', root)) };
    const text = buildNotaText(sampleOrder(), preview);
    openSheet({ title: 'Contoh nota', content: `<pre class="wa-preview">${esc(text)}</pre>` });
  });

  // ---- Kop nota PDF
  const kopForm = $('#set-kop', root);
  const showLogo = () => { $('#logo-preview', root).src = logo || 'icons/logo-kop.png'; };
  showLogo();
  $('#logo-file', root).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast('File harus berupa gambar.', 'error');
    try {
      logo = await shrinkImage(file, 360);
      showLogo();
      toast('Logo siap. Tekan "Simpan kop" untuk menyimpan.', 'info');
    } catch { toast('Gambar tidak bisa dibaca.', 'error'); }
  });
  $('#logo-reset', root).addEventListener('click', () => { logo = ''; showLogo(); });
  const readKop = () => ({
    address: kopForm.address.value.trim(), phone: kopForm.phone.value.trim(), email: kopForm.email.value.trim(),
    website: kopForm.website.value.trim(), logo, paper: kopForm.paper.value || 'A5',
    signer: kopForm.signer.value.trim(), note: kopForm.note.value.trim(),
  });
  kopForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = readKop();
    if (val.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.email)) return toast('Format email tidak valid.', 'error');
    await save(kopForm.querySelector('[type=submit]'), 'letterhead', val);
  });
  $('#btn-kop-preview', root).addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    try {
      await openNotaPDF(sampleOrder(), { ...ctx.settings, letterhead: readKop(), payment: readPay($('#set-bayar', root)) });
    } catch (err) { toast(err.message || 'Gagal membuat PDF.', 'error'); }
  }, 'Membuat PDF…'));

  function sampleOrder() {
    return {
      invoice_number: `${inv.prefix}-${yymm}001`, transaction_date: todayJakarta(), customer_name: 'Contoh Pelanggan',
      customer_phone: '081234567890', service_name: ctx.serviceCategories[0]?.name || 'Penjualan Toko',
      payment_method: 'Transfer Bank', shipping_address: 'Jl. Contoh No. 1, Kota', courier: 'JNE REG', tracking_number: '',
      goods_total: 825000, shipping_fee: 20000, additional_fee: 0, discount: 25000, total_amount: 820000,
      paid_amount: 820000, remaining_amount: 0, payment_status: 'Lunas', order_status: 'Selesai',
      items: [{ item_name: 'Kain batik tulis motif parang 2 m', quantity: 1, unit_price: 475000, subtotal: 475000 },
              { item_name: 'Kemeja batik cap lengan panjang (L)', quantity: 2, unit_price: 175000, subtotal: 350000 }],
    };
  }

  // ---- Saldo
  const saldoForm = $('#set-saldo', root);
  bindMoneyInputs(saldoForm);
  const showSaldo = () => api.balance().then((b) => {
    $('#saldo-now', root).innerHTML = `Saldo saat ini: <b>${rupiah(b.balance)}</b>`;
  }).catch(() => {});
  showSaldo();
  saldoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const start = saldoForm.start_date.value;
    if (start && start > todayJakarta()) return toast('Tanggal mulai tidak boleh di masa depan.', 'error');
    await save(saldoForm.querySelector('[type=submit]'), 'balance',
      { opening_amount: moneyValue(saldoForm.opening_amount), start_date: start || null });
    showSaldo();
  });
  if (ctx.query().bagian === 'saldo') {
    setTimeout(() => saldoForm.scrollIntoView({ block: 'start' }), 50);
  }

  // ---- Nomor nota
  const notaForm = $('#set-nota', root);
  const updInv = () => {
    const p = notaForm.prefix.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'HB';
    $('#inv-preview', root).textContent = `${p}-${yymm}${'1'.padStart(Number(notaForm.digits.value), '0')}`;
  };
  notaForm.addEventListener('input', updInv);
  updInv();
  notaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prefix = notaForm.prefix.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!prefix) return toast('Kode awalan wajib diisi (huruf/angka).', 'error');
    if (prefix !== inv.prefix) {
      const ok = await confirmDialog({ title: 'Ubah kode nota?', message: `Nota baru akan memakai kode <b>${esc(prefix)}</b>. Nota lama tidak berubah.`, okText: 'Ubah' });
      if (!ok) return;
    }
    await save(notaForm.querySelector('[type=submit]'), 'invoice', { prefix, digits: Number(notaForm.digits.value) });
  });

  async function save(btn, key, value) {
    await withBusy(btn, async () => {
      try {
        await api.saveSetting(key, value);
        await ctx.refreshMasterData();
        toast('Pengaturan tersimpan.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- Kategori
  function renderCats() {
    for (const [table, list] of [['service_categories', ctx.serviceCategories], ['expense_categories', ctx.expenseCategories]]) {
      root.querySelector(`[data-table=${table}]`).innerHTML = list.map((c) => `
        <li class="${c.is_active ? '' : 'inactive'}">
          <span>${esc(c.name)}${c.is_active ? '' : ' <small class="muted">(nonaktif)</small>'}</span>
          <span class="cat-actions">
            <button class="icon-btn" data-edit="${c.id}" data-t="${table}" aria-label="Ubah ${esc(c.name)}">${icon('edit')}</button>
            <label class="switch switch-sm" title="Aktif"><input type="checkbox" data-toggle="${c.id}" data-t="${table}" ${c.is_active ? 'checked' : ''} aria-label="Aktifkan ${esc(c.name)}"><span class="switch-ui"></span></label>
          </span>
        </li>`).join('');
    }
  }
  renderCats();

  function catForm(table, cat) {
    const sh = openSheet({
      title: cat ? 'Ubah kategori' : 'Tambah kategori',
      content: `<form class="form-stack" id="cat-form"><label class="field"><span class="field-label">Nama</span>
        <input name="name" maxlength="60" required value="${esc(cat?.name || '')}"></label>
        <button class="btn btn-primary btn-block" type="submit">Simpan</button></form>`,
    });
    sh.el.querySelector('#cat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (!name) return toast('Nama wajib diisi.', 'error');
      await withBusy(e.target.querySelector('[type=submit]'), async () => {
        try {
          await api.saveCategory(table, { id: cat?.id, name, is_active: cat ? cat.is_active : true, sort_order: cat ? undefined : 50 });
          await ctx.refreshMasterData();
          renderCats();
          sh.close();
          toast('Kategori tersimpan.', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  }
  root.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) return catForm(add.dataset.add);
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const list = ed.dataset.t === 'service_categories' ? ctx.serviceCategories : ctx.expenseCategories;
      return catForm(ed.dataset.t, list.find((c) => c.id === ed.dataset.edit));
    }
    return undefined;
  });
  root.addEventListener('change', async (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const list = t.dataset.t === 'service_categories' ? ctx.serviceCategories : ctx.expenseCategories;
    const cat = list.find((c) => c.id === t.dataset.toggle);
    if (!t.checked && list.filter((c) => c.is_active).length <= 1) {
      t.checked = true;
      toast('Minimal satu kategori harus aktif.', 'error');
      return;
    }
    try {
      await api.saveCategory(t.dataset.t, { id: cat.id, name: cat.name, is_active: t.checked });
      await ctx.refreshMasterData();
      renderCats();
      toast(t.checked ? 'Kategori diaktifkan.' : 'Kategori dinonaktifkan (data lama tetap aman).', 'success');
    } catch (err) { t.checked = !t.checked; toast(err.message, 'error'); }
  });

  // ---- Tampilan
  $('#set-tampilan', root).addEventListener('change', (e) => {
    if (e.target.name !== 'font') return;
    setPref('font', e.target.value);
    document.documentElement.dataset.font = e.target.value;
  });

  // ---- Akun
  $('#form-name', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    await withBusy(e.target.querySelector('[type=submit]'), async () => {
      try {
        await api.updateProfileName(e.target.full_name.value.trim());
        if (ctx.profile) ctx.profile.full_name = e.target.full_name.value.trim();
        toast('Nama tersimpan.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  });
  $('#form-pw', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = e.target.pw.value;
    if (pw.length < 8) return toast('Password minimal 8 karakter.', 'error');
    await withBusy(e.target.querySelector('[type=submit]'), async () => {
      try { await api.updatePassword(pw); e.target.reset(); toast('Password diganti.', 'success'); } catch (err) { toast(err.message, 'error'); }
    });
  });
  $('#btn-logout', root).addEventListener('click', () => document.getElementById('btn-logout-side')?.click());

  // Tautan anchor di dalam halaman (jangan ubah hash router)
  root.querySelector('.set-nav').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    root.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/** Perkecil gambar (sisi terpanjang ≤ max px) → data URL PNG, atau JPEG bila terlalu besar. */
function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/png');
      if (out.length > 250000) {
        const ctx2 = c.getContext('2d');
        ctx2.globalCompositeOperation = 'destination-over';
        ctx2.fillStyle = '#fff';
        ctx2.fillRect(0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', 0.85);
      }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('gambar')); };
    img.src = url;
  });
}
