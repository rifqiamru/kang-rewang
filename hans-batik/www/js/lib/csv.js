// Ekspor CSV yang bisa dibuka di Excel & Google Sheets.

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows: array of arrays (baris pertama = judul kolom). */
export function toCSV(rows) {
  // BOM agar Excel membaca UTF-8 (huruf & simbol tampil benar).
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
