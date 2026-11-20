# KANG REWANG — Management System

> *Rewang Apa Bae, Ora Rewel*

Aplikasi manajemen operasional & keuangan untuk usaha jasa **Kang Rewang**: buat nota,
kirim nota ke WhatsApp, data order, rekap harian, pencatatan pengeluaran, dan laporan
keuangan. Dirancang untuk **satu pemilik** yang bekerja dari **HP Android**.

**Input sekali, dipakai di semua tempat.** Nota yang disimpan otomatis masuk ke Data Order,
Dashboard, Rekap Harian, dan Laporan Keuangan. Tidak ada input ulang.

| Lapisan | Teknologi |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES modules) — tanpa framework, tanpa build tool |
| Database & Auth | Supabase (PostgreSQL, Supabase Auth, RLS) |
| Hosting | Netlify (atau hosting statis lain) |
| Aplikasi | PWA — bisa di-install di Android, punya ikon & splash screen |

---

## 1. Struktur folder

```
manajemen/
├── supabase/schema.sql      ← SELURUH database: tabel, trigger, fungsi, RLS, data awal
├── www/                     ← folder yang dipublikasikan (static site)
│   ├── index.html
│   ├── manifest.webmanifest, sw.js, icons/
│   ├── css/app.css
│   ├── vendor/supabase.js   ← supabase-js v2.45.4 (disimpan lokal agar PWA jalan offline)
│   └── js/
│       ├── app.js           ← login, navigasi, router, sinkron draft
│       ├── api.js           ← SATU-SATUNYA pintu ke Supabase
│       ├── ui.js, icons.js
│       ├── lib/             ← format Rupiah/tanggal, perhitungan, template nota & rekap, CSV, grafik, draft
│       └── pages/           ← dashboard, nota, orders, rekap, expenses, reports, settings
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
2. **Base directory:** `manajemen` (build command & publish folder terbaca dari `netlify.toml`).
3. **Site configuration → Environment variables**, tambahkan:
   - `SUPABASE_URL` = `https://xxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = anon / publishable key
4. Deploy. Buka situsnya dari Chrome di HP, login, lalu
   **menu ⋮ → Tambahkan ke layar utama / Install app**.

Landing page Next.js di root repository tidak terpengaruh; aplikasi ini berdiri sendiri di folder `manajemen/`.

### Menjalankan di komputer sendiri

```bash
cd manajemen
cp .env.example .env        # isi SUPABASE_URL & SUPABASE_ANON_KEY
npm run dev                 # → http://localhost:5173
```

---

## 4. Fitur

| Menu | Isi |
|---|---|
| **Dashboard** | Laba bersih hari ini, jumlah transaksi, uang masuk, pendapatan jasa, pengeluaran; order belum selesai & tagihan belum lunas; ringkasan minggu/bulan; aktivitas terbaru; tombol cepat. |
| **Buat Nota** | Nomor nota otomatis `KR-YYMMXXX`, pelanggan, layanan, lokasi & jarak, banyak item barang, ongkos jasa, biaya tambahan, diskon, DP/Lunas, status transaksi. Pratinjau total langsung. Setelah tersimpan: **Salin Nota**, **Bagikan ke WhatsApp**, **Lihat Detail**. |
| **Data Order** | Cari no. nota / nama / no. WA, filter tanggal-layanan-status, detail, tandai Lunas/Selesai, ubah status, **Edit**, **Duplikasi**, **Batalkan**, **Hapus** (dengan konfirmasi). |
| **Rekap Harian** | Pilih tanggal → daftar transaksi, uang masuk, pendapatan jasa, pengeluaran, laba bersih + teks rekap WhatsApp siap salin/kirim. |
| **Pengeluaran** | Catat/ubah/hapus pengeluaran, cari, filter tanggal & kategori, total hari/minggu/bulan. |
| **Laporan Keuangan** | Hari ini, kemarin, minggu ini, bulan ini, bulan lalu, rentang bebas. 8 angka utama, grafik harian, tabel harian, rincian per layanan & kategori, **export CSV** (transaksi, pengeluaran, laporan). |
| **Pengaturan** | Identitas usaha, info pembayaran (aktif/nonaktif per metode), kategori layanan & pengeluaran, format nomor nota, ukuran huruf, nama & password akun, logout. |

---

## 5. Aturan akuntansi (dihitung di database)

Semua angka dihitung oleh **trigger PostgreSQL** (`orders_compute`, `order_items_compute`)
dan **fungsi laporan** (`get_financial_summary`, `get_daily_series`). Dashboard, Rekap,
dan Laporan memakai fungsi yang **sama**, sehingga angkanya selalu konsisten.
JavaScript hanya menampilkan pratinjau.

| Istilah | Rumus |
|---|---|
| Total barang | Σ (jumlah × harga satuan) dari item |
| **Total tagihan** | total barang + ongkos jasa + biaya tambahan − diskon |
| **Pendapatan jasa** | ongkos jasa + biaya tambahan *(jika ditandai pendapatan)* − diskon |
| **Dana titipan** | total barang + biaya tambahan *(jika hanya penggantian biaya)* |
| **Uang masuk** | jumlah yang benar-benar dibayar: Lunas = total, DP = nominal DP, Belum Bayar = 0 |
| **Piutang** | total tagihan − uang masuk |
| **Pengeluaran** | jumlah tabel pengeluaran (bensin, parkir, tol, dst.) |
| **Keuntungan bersih** | pendapatan jasa − pengeluaran |

- Pendapatan jasa **diakui hanya untuk order berstatus *Selesai***. Order yang belum selesai
  ditampilkan terpisah sebagai “jasa dari order belum selesai”.
- Order **Dibatalkan** tidak dihitung sama sekali, tetapi riwayatnya tetap tersimpan.
- Uang belanja pelanggan **tidak pernah** dihitung sebagai keuntungan.
- Semua transaksi dihitung berdasarkan **tanggal transaksi** (zona waktu Asia/Jakarta).

Contoh wajib (diuji otomatis): Transaksi A (barang 71.000 + jasa 20.000) dan B (jasa 25.000),
pengeluaran bensin 20.000 + parkir 5.000 →
**nilai transaksi 116.000 · pendapatan jasa 45.000 · dana titipan 71.000 · pengeluaran 25.000 · laba 20.000.**

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
- **Angka tidak bisa dimanipulasi** dari luar: total, pendapatan, dana titipan, dan nomor nota selalu dihitung ulang oleh trigger.
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

Cakupan otomatis (bagian 17 spesifikasi): nota 1 barang, banyak barang, tanpa barang, tanpa nama
pelanggan, ongkos jasa, diskon & biaya tambahan, format WhatsApp, nomor nota tidak duplikat; simpan,
edit, batalkan, hapus, ubah status, DP & pelunasan; tambah/edit/hapus pengeluaran; skenario keuangan
wajib konsisten di Dashboard, Rekap & Laporan; salin & tombol WhatsApp; layar 320 px; login/logout; offline.

**Perlu dicek manual di HP sungguhan setelah deploy:** instalasi PWA dari Chrome Android, login ke
Supabase asli, dan membuka aplikasi WhatsApp dari tombol *Bagikan*.

---

## 8. Catatan & batasan

- Uang masuk dihitung pada **tanggal transaksi**. Jika DP dibayar hari ini dan pelunasan minggu depan,
  pelunasan tercatat pada tanggal transaksi aslinya (belum ada tabel riwayat pembayaran terpisah).
- Hanya **draft nota** yang bisa dibuat saat offline; pengeluaran & perubahan lain butuh koneksi.
- CSV memakai pemisah koma + BOM UTF-8. Jika Excel berbahasa Indonesia menampilkan semua dalam satu
  kolom, buka lewat **Data → From Text/CSV** dan pilih pemisah *Comma*, atau buka di Google Sheets.
