# HANS BATIK — Management System

> Aplikasi manajemen penjualan & keuangan toko batik + **nota PDF berkop Hans Batik**

Dibangun dari aplikasi Kang Rewang, disesuaikan untuk **toko batik**: buat nota penjualan,
**unduh / bagikan nota PDF dengan kop usaha** (logo, alamat, kontak), kirim teks nota ke WhatsApp,
data penjualan, rekap harian, pengeluaran, dan laporan keuangan. Dirancang untuk **satu pemilik**
yang bekerja dari **HP Android**.

**Input sekali, dipakai di semua tempat.** Nota yang disimpan otomatis masuk ke Data Penjualan,
Dashboard, Rekap Harian, Laporan Keuangan, dan bisa langsung dijadikan PDF.

| Lapisan | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES modules) — tanpa framework, tanpa build tool |
| Nota PDF | jsPDF v2.5.2 (disimpan lokal di `www/vendor/`, jalan offline) |
| Database & Auth | Supabase (PostgreSQL, Supabase Auth, RLS) |
| Hosting | Netlify (atau hosting statis lain) |
| Aplikasi | PWA — bisa di-install di Android, punya ikon & splash screen |

---

## Nota PDF berkop

Setelah nota disimpan (dan di halaman **Detail Transaksi**) ada kartu **Nota PDF berkop**:

| Tombol | Fungsi |
|---|---|
| **Bagikan PDF** | Membuka menu berbagi HP → pilih WhatsApp, Telegram, email, dll. File PDF langsung terlampir. (Jika perangkat tidak mendukung, PDF diunduh.) |
| **Unduh PDF** | Menyimpan `Nota-HB-YYMMxxx.pdf` ke folder Download. |
| **Lihat / Cetak** | Membuka PDF di tab baru untuk dilihat atau dicetak. |

Isi nota PDF: **kop** (logo, nama usaha, tagline, alamat, telepon/WA, email, website/IG, garis ganda) ·
judul *NOTA PENJUALAN* · no. nota, tanggal, kategori penjualan, metode bayar · data pelanggan & alamat ·
tabel barang (No, Nama Barang, Qty, Harga, Jumlah) · subtotal, ongkir, biaya tambahan, diskon, **TOTAL** ·
DP & sisa bayar · stempel **LUNAS / BELUM LUNAS / DIBATALKAN** · **terbilang** · info pengiriman (kurir & resi) ·
info pembayaran (rekening/QRIS) · catatan kaki · kolom tanda tangan *Penerima* & *Hormat kami*.
Nota panjang otomatis lanjut ke halaman berikutnya (dengan nomor halaman).

**Atur kop di Pengaturan → Kop nota PDF:** unggah logo (otomatis diperkecil), alamat, telepon, email,
website/Instagram, ukuran kertas **A5** (bawaan) atau **A4**, nama penanda tangan, dan catatan kaki
(mis. ketentuan retur). Tombol **Contoh PDF** menampilkan hasilnya sebelum disimpan.
Nama usaha, tagline, dan no. WA diambil dari **Identitas usaha**. Jika logo belum diunggah,
dipakai logo bawaan `www/icons/logo-kop.png`.

---

## 1. Struktur folder

```
hans-batik/
├── supabase/schema.sql      ← SELURUH database: tabel, trigger, fungsi, RLS, data awal
├── www/                     ← folder yang dipublikasikan (static site)
│   ├── index.html
│   ├── manifest.webmanifest, sw.js, icons/
│   ├── css/app.css
│   ├── vendor/              ← supabase-js v2.45.4 & jsPDF v2.5.2 (disimpan lokal agar PWA jalan offline)
│   └── js/
│       ├── app.js           ← login, navigasi, router, sinkron draft
│       ├── api.js           ← SATU-SATUNYA pintu ke Supabase
│       ├── ui.js, icons.js
│       ├── lib/             ← format Rupiah/tanggal/terbilang, perhitungan, template nota & rekap, pdf.js (nota PDF berkop), CSV, grafik, draft
│       └── pages/           ← dashboard, nota, orders (data penjualan), rekap, expenses, reports, settings
├── scripts/build-config.mjs ← membuat www/js/config.js dari environment variable
├── tests/                   ← uji unit, uji database, uji UI
└── netlify.toml
```

---

## 2. Menyiapkan Supabase (sekali saja)

1. Buat project di <https://supabase.com> (region **Southeast Asia (Singapore)** disarankan).
2. **Buat database:** buka **SQL Editor → New query**, salin seluruh isi
   [`supabase/schema.sql`](supabase/schema.sql), lalu **Run**.
   File ini aman dijalankan ulang (misalnya saat ada pembaruan fungsi).
3. **Buat akun pemilik:** **Authentication → Users → Add user → Create new user**,
   isi email & password, centang *Auto Confirm User*.
   > Akun **pertama** otomatis menjadi **pemilik**. Akun lain (jika ada) tidak bisa melihat data apa pun.
4. **Matikan pendaftaran umum:** **Authentication → Sign In / Providers → Email**,
   matikan **Allow new users to sign up**. (Lapisan pengaman tambahan.)
5. **URL login:** **Authentication → URL Configuration → Site URL** = alamat Netlify Anda
   (dibutuhkan untuk fitur *Lupa password*).
6. Catat **Project URL** dan **anon / publishable key** dari **Project Settings → API**.

> ⚠️ **Jangan pernah** memakai `service_role` / secret key di aplikasi ini.
> Skrip build akan **menolak** deploy jika key tersebut terdeteksi.

---

## 3. Deploy ke Netlify

1. **Add new site → Import an existing project** → pilih repository ini.
2. **Project configuration → Build & deploy → Continuous deployment → Build settings → Configure**:
   **Base directory** = `hans-batik`, Build command & Publish directory dikosongkan (terbaca dari `netlify.toml`).
3. **Project configuration → Environment variables**, tambahkan:
   - `SUPABASE_URL` = `https://xxxx.supabase.co` (xxxx = Project ID; bagian path seperti `/rest/v1` otomatis dibuang)
   - `SUPABASE_ANON_KEY` = anon / publishable key
4. Deploy. Buka situsnya dari Chrome di HP, login, lalu
   **menu ⋮ → Tambahkan ke layar utama / Install app**.

Plugin Next.js Netlify dilewati otomatis (`NETLIFY_NEXT_PLUGIN_SKIP` di `netlify.toml`) karena landing page Next.js di root repository bukan bagian aplikasi ini; aplikasi ini berdiri sendiri di folder `hans-batik/`.

> Gunakan **project Supabase baru** dan **site Netlify baru** khusus Hans Batik — jangan dicampur dengan Kang Rewang.

### Menjalankan di komputer sendiri

```bash
cd hans-batik
cp .env.example .env        # isi SUPABASE_URL & SUPABASE_ANON_KEY
npm run dev                 # → http://localhost:5173
```

---

## 4. Fitur

| Menu | Isi |
|---|---|
| **Dashboard** | Saldo usaha, laba bersih hari ini, jumlah transaksi, uang masuk, penjualan, pengeluaran; order belum selesai & tagihan belum lunas; ringkasan minggu/bulan; aktivitas terbaru. |
| **Buat Nota** | Nomor nota otomatis `HB-YYMMXXX`, pelanggan & no. WA, **kategori penjualan** (Toko, WhatsApp, Marketplace, Instagram/TikTok, Pesanan Khusus, Grosir/Reseller), banyak barang (qty × harga), **ongkos kirim**, biaya tambahan (mis. jahit), diskon, Lunas/DP/Belum Bayar, **alamat kirim, kurir & no. resi**, status Pesanan → Diproses → Dikirim → Selesai. Bawaan: Lunas & Selesai (penjualan di toko). Setelah tersimpan: **Nota PDF berkop**, salin teks, kirim teks ke WhatsApp. |
| **Data Penjualan** | Cari no. nota / nama / no. WA, filter tanggal-kategori-status, detail (+ nota PDF), tandai Lunas/Selesai, ubah status, **Edit**, **Duplikasi**, **Batalkan**, **Hapus**. |
| **Rekap Harian** | Saldo awal, pemasukan (penjualan Selesai), pengeluaran, saldo akhir + teks rekap WhatsApp. |
| **Pengeluaran** | Kategori bawaan: pembelian kain/bahan, pewarna & malam, upah pembatik/penjahit, gaji, kemasan, ongkir, listrik/air/internet, sewa, iklan, lainnya. |
| **Laporan Keuangan** | Hari ini s/d rentang bebas, grafik harian, penjualan per kategori, pengeluaran per kategori, **export CSV**. |
| **Pengaturan** | Identitas usaha, **kop nota PDF**, info pembayaran, saldo awal, kategori penjualan & pengeluaran, format nomor nota, ukuran huruf, akun. |

---

## 5. Aturan akuntansi (dihitung di database)

Semua angka dihitung oleh **trigger PostgreSQL** (`orders_compute`, `order_items_compute`)
dan **fungsi laporan** (`get_financial_summary`, `get_daily_series`, `get_balance`).
JavaScript hanya menampilkan pratinjau.

| Istilah | Rumus |
|---|---|
| Total barang | Σ (jumlah × harga satuan) |
| **Total tagihan** | total barang + ongkos kirim + biaya tambahan − diskon |
| **Pendapatan penjualan** | total barang + biaya tambahan *(jika ditandai pendapatan, mis. jahit)* − diskon |
| **Ongkir & titipan** | ongkos kirim + biaya tambahan *(jika hanya penggantian biaya)* — diteruskan ke ekspedisi, **bukan** pendapatan |
| **Uang masuk** | Lunas = total, DP = nominal DP, Belum Bayar = 0 |
| **Piutang** | total tagihan − uang masuk |
| **Keuntungan bersih** | pendapatan penjualan − pengeluaran (termasuk belanja kain/bahan) |
| **Saldo usaha** | saldo awal + pendapatan penjualan − pengeluaran |

- Pendapatan diakui **hanya untuk order berstatus *Selesai*** (pesanan yang masih Diproses/Dikirim ditampilkan terpisah).
- Order **Dibatalkan** tidak dihitung, riwayat tetap tersimpan.
- Laba dihitung dengan cara sederhana (kas): belanja bahan/stok dicatat sebagai pengeluaran pada tanggal dibeli.
  Aplikasi belum menghitung HPP per barang atau stok gudang.

Contoh (diuji otomatis): Penjualan A (kemeja 2 × 175.000 + kain 475.000 + ongkir 20.000) dan
B (selendang 75.000), pengeluaran kain 300.000 + kemasan 25.000 →
**nilai transaksi 920.000 · penjualan 900.000 · ongkir 20.000 · pengeluaran 325.000 · laba 575.000.**

---

## 6. Keamanan & keandalan data

- **RLS aktif di semua tabel**; hanya akun pemilik (`profiles.is_owner`) yang bisa membaca/menulis.
  Pengunjung anonim dan akun lain ditolak.
- **Nomor nota** dibuat di server oleh `next_invoice_number` memakai baris penghitung yang
  dikunci (`INSERT … ON CONFLICT DO UPDATE`) → unik walau disimpan bersamaan. Diuji dengan 40
  penyimpanan paralel.
- **Simpan nota bersifat atomik** (`save_order`): order + semua item tersimpan bersama atau tidak sama sekali.
- **Anti simpan ganda**: setiap formulir membawa `client_request_id` (UUID). Klik ganda, simpan ulang,
  atau sinkron draft tidak akan pernah membuat transaksi kedua. Tombol juga dikunci saat menyimpan.
- **Angka tidak bisa dimanipulasi** dari luar: total, pendapatan, ongkir, dan nomor nota selalu dihitung ulang oleh trigger.
- **Uang = INTEGER**, primary key = UUID, waktu = TIMESTAMPTZ.
- Kategori yang sudah dipakai tidak bisa dihapus (hanya dinonaktifkan).
- `localStorage` hanya untuk **draft nota** dan **preferensi tampilan**, bukan database.

### Saat koneksi internet putus
- Muncul bilah merah *Offline*. Aplikasi **tidak pernah** mengatakan data tersimpan jika gagal.
- Isian nota otomatis tersimpan sebagai **draft di HP**. Jika tombol Simpan ditekan saat offline,
  nota ditandai *tertunda* dan **dikirim otomatis** ketika koneksi kembali — aman dari duplikat
  berkat `client_request_id`.

---

## 7. Pengujian

```bash
npm test          # uji unit: format Rupiah/tanggal, perhitungan, teks nota & rekap WhatsApp, CSV
npm run test:db   # uji database di PostgreSQL lokal: skema, trigger, RLS, idempoten, konkurensi nomor nota
npm run test:ui   # uji UI end-to-end (Playwright, layar HP) dengan API tiruan + tangkapan layar
```

Cakupan otomatis: perhitungan nota (barang, ongkir, biaya tambahan, diskon, DP), format teks WhatsApp,
**nota PDF berkop** (A5 & A4, isi kop/tabel/total/terbilang/stempel, logo tertanam, nota panjang multi-halaman,
unduh & bagikan dari aplikasi), terbilang, nomor nota `HB-` unik (40 penyimpanan paralel), simpan/edit/batal/hapus,
skenario keuangan konsisten di Dashboard, Rekap & Laporan, pengaturan kop (unggah logo, kertas), RLS, offline, layar 320 px.

**Perlu dicek manual di HP sungguhan setelah deploy:** instalasi PWA dari Chrome Android, login ke
Supabase asli, dan membuka aplikasi WhatsApp dari tombol *Bagikan*.

---

## 8. Catatan & batasan

- Uang masuk dihitung pada **tanggal transaksi**. Jika DP dibayar hari ini dan pelunasan minggu depan,
  pelunasan tercatat pada tanggal transaksi aslinya (belum ada tabel riwayat pembayaran terpisah).
- Hanya **draft nota** yang bisa dibuat saat offline; pengeluaran & perubahan lain butuh koneksi.
- CSV memakai pemisah koma + BOM UTF-8. Jika Excel berbahasa Indonesia menampilkan semua dalam satu
  kolom, buka lewat **Data → From Text/CSV** dan pilih pemisah *Comma*, atau buka di Google Sheets.
