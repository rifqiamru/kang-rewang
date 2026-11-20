// Nota PDF dengan kop usaha (Hans Batik).
// buildNotaPDF() adalah fungsi murni: menerima konstruktor jsPDF sehingga bisa
// diuji di Node. Bagian bawah file berisi helper khusus browser (memuat jsPDF,
// unduh, bagikan) yang baru menyentuh DOM saat dipanggil.
import { formatDateLong, formatQuantity, formatNumber, terbilang } from './format.js';
import { DEFAULT_SETTINGS, paymentLines } from './templates.js';

// Warna kop (sogan / cokelat batik + emas).
const C = {
  brown: [92, 46, 18],
  brownSoft: [139, 69, 19],
  gold: [184, 134, 11],
  cream: [250, 244, 234],
  ink: [33, 25, 20],
  muted: [110, 98, 88],
  line: [222, 208, 190],
  green: [22, 128, 61],
  red: [185, 28, 28],
};

const PAPER = {
  A5: { w: 148, h: 210, m: 9, fs: 1, logo: 18 },
  A4: { w: 210, h: 297, m: 16, fs: 1.15, logo: 24 },
};

const R = (n) => 'Rp ' + formatNumber(n);

/**
 * Font standar PDF hanya mendukung huruf Latin. Emoji & simbol lain dibuang,
 * tanda baca "pintar" diganti versi biasa agar tidak muncul karakter aneh.
 */
export function pdfSafe(v) {
  return String(v ?? '')
    .replace(/[‒-―−]/g, '-')
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/[️‍]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Nama file PDF, mis. "Nota-HB-2611001.pdf" */
export function notaFileName(order) {
  return `Nota-${String(order.invoice_number || 'baru').replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
}

/**
 * Buat dokumen nota PDF.
 * @param {Function} JsPDF   konstruktor jsPDF
 * @param {object} order     hasil get_order (dengan items & service_name)
 * @param {object} settings  hasil mergeSettings
 * @param {object} [opt]     { logo: dataURL PNG/JPEG, compress: false untuk pengujian }
 * @returns jsPDF document
 */
export function buildNotaPDF(JsPDF, order, settings = DEFAULT_SETTINGS, opt = {}) {
  const biz = settings.business || {};
  const kop = { ...DEFAULT_SETTINGS.letterhead, ...(settings.letterhead || {}) };
  const P = PAPER[kop.paper] || PAPER.A5;
  const doc = new JsPDF({ unit: 'mm', format: kop.paper === 'A4' ? 'a4' : 'a5', orientation: 'portrait', compress: opt.compress !== false });
  const W = P.w; const H = P.h; const M = P.m;
  const fs = (n) => n * P.fs;
  const color = (c, kind = 'text') => {
    if (kind === 'text') doc.setTextColor(...c);
    else if (kind === 'draw') doc.setDrawColor(...c);
    else doc.setFillColor(...c);
  };
  const font = (style = 'normal', size = 9) => { doc.setFont('helvetica', style); doc.setFontSize(fs(size)); };
  const lh = (size) => fs(size) * 0.42; // tinggi baris (mm) untuk ukuran font pt
  const wrap = (text, width) => doc.splitTextToSize(pdfSafe(text), width);

  const title = pdfSafe(biz.name || 'HANS BATIK').toUpperCase();
  doc.setProperties({
    title: `Nota ${order.invoice_number || ''} - ${title}`.trim(),
    subject: 'Nota penjualan',
    author: title,
    creator: `${title} Management System`,
  });

  let y = M;

  // ------------------------------------------------------------------ KOP
  function drawKop() {
    const logoSize = P.logo;
    let textX = M;
    if (opt.logo) {
      try {
        const props = doc.getImageProperties(opt.logo);
        const ratio = props.width / props.height || 1;
        const lw = ratio >= 1 ? logoSize : logoSize * ratio;
        const lhgt = ratio >= 1 ? logoSize / ratio : logoSize;
        doc.addImage(opt.logo, props.fileType || 'PNG', M, y + (logoSize - lhgt) / 2, lw, lhgt);
        textX = M + logoSize + 4;
      } catch { /* logo rusak: kop tetap dibuat tanpa logo */ }
    }
    const textW = W - M - textX;
    let ty = y + lh(18) * 0.95;
    font('bold', 18); color(C.brown);
    doc.text(title, textX, ty, { charSpace: 0.6 });
    ty += lh(9) + 1;
    if (biz.tagline) {
      font('italic', 9); color(C.gold);
      doc.text(pdfSafe(biz.tagline), textX, ty);
      ty += lh(8.5) + 0.6;
    }
    font('normal', 8); color(C.ink);
    if (kop.address) {
      const lines = wrap(kop.address, textW);
      doc.text(lines, textX, ty);
      ty += lines.length * lh(8) + 0.4;
    }
    const contact = [
      (kop.phone || biz.whatsapp) && `Telp/WA: ${kop.phone || biz.whatsapp}`,
      kop.email && `Email: ${kop.email}`,
      kop.website && kop.website,
    ].filter(Boolean).join('  |  ');
    if (contact) {
      const lines = wrap(contact, textW);
      color(C.muted);
      doc.text(lines, textX, ty);
      ty += lines.length * lh(8);
    }
    y = Math.max(y + logoSize, ty) + 2.5;
    // Garis ganda khas kop surat.
    color(C.brown, 'draw'); doc.setLineWidth(0.9); doc.line(M, y, W - M, y);
    color(C.gold, 'draw'); doc.setLineWidth(0.3); doc.line(M, y + 1.3, W - M, y + 1.3);
    y += 7;
  }
  drawKop();

  // ------------------------------------------------------------------ Judul & info
  font('bold', 12.5); color(C.brown);
  doc.text('NOTA PENJUALAN', W / 2, y, { align: 'center', charSpace: 1.2 });
  y += lh(12) + 3;

  const colW = (W - 2 * M - 6) / 2;
  const leftX = M; const rightX = M + colW + 6;
  font('normal', 8.5);
  const labW = Math.max(...['No. Nota', 'Tanggal', 'Penjualan', 'Bayar via', 'Kepada', 'No. HP/WA', 'Alamat']
    .map((l) => doc.getTextWidth(l))) + 2.5;
  function infoRows(x, rows) {
    let yy = y;
    for (const [label, value] of rows) {
      if (!value) continue;
      font('normal', 8.5); color(C.muted);
      doc.text(label, x, yy);
      font(label === 'No. Nota' ? 'bold' : 'normal', 8.5); color(C.ink);
      const lines = wrap(value, colW - labW);
      doc.text(lines, x + labW, yy);
      yy += lines.length * lh(8.5) + 1.2;
    }
    return yy;
  }
  const yl = infoRows(leftX, [
    ['No. Nota', order.invoice_number || '-'],
    ['Tanggal', formatDateLong(order.transaction_date)],
    ['Penjualan', order.service_name || ''],
    ['Bayar via', order.payment_method || ''],
  ]);
  const yr = infoRows(rightX, [
    ['Kepada', String(order.customer_name || '').trim() || 'Pelanggan'],
    ['No. HP/WA', order.customer_phone || ''],
    ['Alamat', order.shipping_address || ''],
  ]);
  y = Math.max(yl, yr) + 1.5;

  const desc = pdfSafe(order.description);
  if (desc) {
    font('italic', 8.5); color(C.muted);
    const lines = wrap(`Keterangan: ${desc}`, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * lh(8.5) + 1.5;
  }

  // ------------------------------------------------------------------ Tabel barang
  const cols = [
    { key: 'no', label: 'No', w: fs(8), align: 'center' },
    { key: 'name', label: 'Nama Barang', w: 0, align: 'left' },
    { key: 'qty', label: 'Qty', w: fs(11), align: 'center' },
    { key: 'price', label: 'Harga', w: fs(24), align: 'right' },
    { key: 'sub', label: 'Jumlah', w: fs(26), align: 'right' },
  ];
  const tableW = W - 2 * M;
  cols[1].w = tableW - cols.reduce((t, c) => t + c.w, 0);
  const pad = 1.8;
  const cellX = (c, x) => (c.align === 'right' ? x + c.w - pad : c.align === 'center' ? x + c.w / 2 : x + pad);

  function tableHeader() {
    const hh = 7;
    color(C.brown, 'fill');
    doc.rect(M, y, tableW, hh, 'F');
    font('bold', 8.5); color([255, 255, 255]);
    let x = M;
    for (const c of cols) {
      doc.text(c.label, cellX(c, x), y + hh / 2 + 1.2, { align: c.align });
      x += c.w;
    }
    y += hh;
  }
  const bottomLimit = H - M - 6;
  function ensure(space) {
    if (y + space <= bottomLimit) return false;
    doc.addPage();
    y = M;
    return true;
  }

  tableHeader();
  const items = (order.items || []).length ? order.items : [{
    item_name: desc || order.service_name || 'Pembelian batik', quantity: 1,
    unit_price: order.goods_total || 0, subtotal: order.goods_total || 0,
  }];
  items.forEach((it, i) => {
    font('normal', 8.5);
    const nameLines = wrap(it.item_name, cols[1].w - 2 * pad);
    const rowH = Math.max(6.2, nameLines.length * lh(8.5) + 3);
    if (ensure(rowH)) tableHeader();
    if (i % 2 === 1) { color(C.cream, 'fill'); doc.rect(M, y, tableW, rowH, 'F'); }
    color(C.ink);
    const base = y + 4.1;
    let x = M;
    const vals = {
      no: String(i + 1), name: nameLines, qty: formatQuantity(it.quantity),
      price: formatNumber(it.unit_price), sub: formatNumber(it.subtotal ?? Math.round(it.quantity * it.unit_price)),
    };
    for (const c of cols) {
      doc.text(vals[c.key], cellX(c, x), base, { align: c.align });
      x += c.w;
    }
    y += rowH;
    color(C.line, 'draw'); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);
  });
  color(C.brown, 'draw'); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  y += 3;

  // ------------------------------------------------------------------ Total
  const goods = order.goods_total ?? items.reduce((t, it) => t + (Number(it.subtotal) || 0), 0);
  const rows = [['Subtotal', R(goods)]];
  if (Number(order.shipping_fee) > 0) rows.push([`Ongkos kirim${order.courier ? ` (${pdfSafe(order.courier)})` : ''}`, R(order.shipping_fee)]);
  if (Number(order.additional_fee) > 0) rows.push(['Biaya tambahan', R(order.additional_fee)]);
  if (Number(order.discount) > 0) rows.push(['Diskon', '- ' + R(order.discount)]);
  const totW = fs(66);
  const totX = W - M - totW;
  const totalsH = rows.length * 5 + 9 + (order.payment_status === 'DP' ? 10 : 5);
  ensure(totalsH + 12);
  const yTot0 = y;

  font('normal', 8.5);
  for (const [l, v] of rows) {
    color(C.muted); doc.text(l, totX, y + 3.5);
    color(C.ink); doc.text(v, W - M, y + 3.5, { align: 'right' });
    y += 5;
  }
  color(C.brown, 'fill');
  doc.rect(totX - 2, y, totW + 2, 8, 'F');
  font('bold', 10); color([255, 255, 255]);
  doc.text('TOTAL', totX, y + 5.4);
  doc.text(R(order.total_amount), W - M - 1.5, y + 5.4, { align: 'right' });
  y += 9.5;
  font('normal', 8.5);
  if (order.payment_status === 'DP') {
    color(C.muted); doc.text('Dibayar (DP)', totX, y + 3.2);
    color(C.ink); doc.text(R(order.paid_amount), W - M, y + 3.2, { align: 'right' });
    y += 5;
    font('bold', 8.5); color(C.red); doc.text('Sisa bayar', totX, y + 3.2);
    doc.text(R(order.remaining_amount), W - M, y + 3.2, { align: 'right' });
    y += 5;
  }

  // Kiri bawah total: stempel status + terbilang.
  const leftW = totX - M - 6;
  let ly = yTot0 + 1;
  const stamp = order.order_status === 'Dibatalkan' ? ['DIBATALKAN', C.red]
    : order.payment_status === 'Lunas' ? ['LUNAS', C.green]
      : order.payment_status === 'DP' ? ['DP / BELUM LUNAS', C.gold] : ['BELUM LUNAS', C.red];
  font('bold', 11);
  const sw = doc.getTextWidth(stamp[0]) + stamp[0].length * 0.5 + 8;
  color(stamp[1], 'draw'); color(stamp[1]); doc.setLineWidth(0.7);
  doc.roundedRect(M, ly, sw, 8.5, 1.5, 1.5, 'S');
  doc.text(stamp[0], M + 4, ly + 5.8, { charSpace: 0.5 });
  ly += 13;
  font('italic', 8); color(C.muted);
  doc.text('Terbilang:', M, ly);
  ly += lh(8) + 0.6;
  font('bolditalic', 8.5); color(C.ink);
  const tb = wrap(`${terbilang(order.total_amount)} rupiah`, leftW);
  doc.text(tb, M, ly);
  ly += tb.length * lh(8.5);
  y = Math.max(y, ly) + 3;

  // ------------------------------------------------------------------ Pengiriman & pembayaran
  const infoBlocks = [];
  if (order.courier || order.tracking_number) {
    infoBlocks.push(['Pengiriman', [
      order.courier && `Kurir: ${order.courier}`,
      order.tracking_number && `No. resi: ${order.tracking_number}`,
    ].filter(Boolean)]);
  }
  const pays = paymentLines(settings).map((p) => `${p.label}: ${p.value}`);
  if (pays.length) {
    if (settings.payment?.account_holder) pays.push(`a.n ${settings.payment.account_holder}`);
    infoBlocks.push(['Pembayaran', pays]);
  }
  if (infoBlocks.length) {
    const bw = infoBlocks.length === 1 ? W - 2 * M : (W - 2 * M - 4) / 2;
    const blockLines = infoBlocks.map(([, ls]) => ls.flatMap((l) => wrap(l, bw - 6)));
    const bh = Math.max(...blockLines.map((ls) => ls.length)) * lh(8) + 7.5;
    ensure(bh + 2);
    infoBlocks.forEach(([head], i) => {
      const bx = M + i * (bw + 4);
      color(C.cream, 'fill'); color(C.line, 'draw'); doc.setLineWidth(0.25);
      doc.roundedRect(bx, y, bw, bh, 1.5, 1.5, 'FD');
      font('bold', 8.5); color(C.brown);
      doc.text(head.toUpperCase(), bx + 3, y + 4.6);
      font('normal', 8); color(C.ink);
      doc.text(blockLines[i], bx + 3, y + 8.8);
    });
    y += bh + 3;
  }

  // ------------------------------------------------------------------ Catatan & tanda tangan
  if (kop.note) {
    font('italic', 7.5); color(C.muted);
    const lines = wrap(`Catatan: ${kop.note}`, W - 2 * M);
    ensure(lines.length * lh(7.5) + 2);
    doc.text(lines, M, y);
    y += lines.length * lh(7.5) + 2;
  }

  const signH = 18;
  ensure(signH + 3);
  const sigW = fs(42);
  const sigs = [
    ['Penerima,', String(order.customer_name || '').trim() || '(..........................)', M + sigW / 2],
    ['Hormat kami,', kop.signer || biz.owner_name || title, W - M - sigW / 2],
  ];
  for (const [head, name, cx] of sigs) {
    font('normal', 8.5); color(C.ink);
    doc.text(head, cx, y + 3, { align: 'center' });
    color(C.muted, 'draw'); doc.setLineWidth(0.25);
    doc.line(cx - sigW / 2, y + signH - 4, cx + sigW / 2, y + signH - 4);
    font('bold', 8.5);
    doc.text(wrap(name, sigW)[0] || '', cx, y + signH, { align: 'center' });
  }
  y += signH + 3;

  // ------------------------------------------------------------------ Kaki halaman (semua halaman)
  const footer = pdfSafe(biz.nota_footer);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    color(C.gold, 'draw'); doc.setLineWidth(0.3);
    doc.line(M, H - M - 3.5, W - M, H - M - 3.5);
    font('italic', 7.5); color(C.muted);
    if (footer) doc.text(footer, M, H - M, { maxWidth: W - 2 * M - 22 });
    if (pages > 1) doc.text(`Hal. ${p}/${pages}`, W - M, H - M, { align: 'right' });
  }
  return doc;
}

// ======================================================================
// Helper browser
// ======================================================================
let jsPDFPromise = null;

/** Muat vendor/jspdf.umd.min.js sekali saja (disimpan juga oleh service worker). */
export function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPDFPromise) {
    jsPDFPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF tidak tersedia.')));
      s.onerror = () => { jsPDFPromise = null; reject(new Error('Gagal memuat pembuat PDF. Periksa koneksi lalu coba lagi.')); };
      document.head.appendChild(s);
    });
  }
  return jsPDFPromise;
}

const DEFAULT_LOGO = 'icons/logo-kop.png';
let defaultLogoCache = null;
async function fetchAsDataURL(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('logo');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Logo untuk kop: dari Pengaturan, atau logo bawaan aplikasi. */
export async function kopLogo(settings) {
  const own = settings?.letterhead?.logo;
  if (own && /^data:image\/(png|jpe?g);base64,/.test(own)) return own;
  if (!defaultLogoCache) defaultLogoCache = fetchAsDataURL(DEFAULT_LOGO).catch(() => null);
  return defaultLogoCache;
}

/** Hasilkan Blob PDF nota. */
export async function notaPdfBlob(order, settings) {
  const [JsPDF, logo] = await Promise.all([loadJsPDF(), kopLogo(settings)]);
  const doc = buildNotaPDF(JsPDF, order, settings, { logo });
  return doc.output('blob');
}

/** Unduh file PDF nota ke HP/komputer. */
export async function downloadNotaPDF(order, settings) {
  const blob = await notaPdfBlob(order, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = notaFileName(order);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return blob;
}

/**
 * Bagikan PDF lewat menu berbagi HP (WhatsApp, Telegram, email, dsb.).
 * @returns {'shared'|'cancelled'|'downloaded'}  'downloaded' bila perangkat tidak mendukung berbagi file.
 */
export async function shareNotaPDF(order, settings) {
  const blob = await notaPdfBlob(order, settings);
  const file = new File([blob], notaFileName(order), { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Nota ${order.invoice_number}` });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  await downloadNotaPDF(order, settings);
  return 'downloaded';
}

/** Buka PDF di tab baru (pratinjau / cetak). */
export async function openNotaPDF(order, settings) {
  const blob = await notaPdfBlob(order, settings);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url; a.download = notaFileName(order);
    document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
