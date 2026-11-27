# Qreativa Voice — TTS Bahasa Indonesia + Clone Voice

Aplikasi web lokal untuk mengubah teks bahasa Indonesia menjadi suara (.wav), termasuk clone voice dari rekaman 3–10 detik.

Mesin: **OmniVoice** (k2-fsa), model TTS zero-shot open-source dengan 600+ bahasa. Bahasa Indonesia termasuk yang didukung, dan pada benchmark paper-nya kemiripan suaranya lebih tinggi dari ElevenLabs.

## Fitur
- **Suara Bawaan**: pilih jenis kelamin, usia, dan nada, tanpa rekaman. Nama karakter tampil dalam bahasa Indonesia (Perempuan, Dewasa muda, Sedang, dst.) dengan nama aslinya (female, young adult, moderate pitch) dalam huruf kecil di sebelahnya.
- **Clone Voice**: upload atau rekam suara referensi. Transkripnya bisa diisi otomatis lewat Whisper.
- **Suara Tersimpan**: simpan hasil clone (misal `rifqi_promo`) supaya bisa dipakai berulang tanpa upload ulang.
- **Normalisasi teks Indonesia**: `Rp 750.000/org` dibaca "tujuh ratus lima puluh ribu rupiah per orang". Ini juga berlaku untuk jam, tanggal, persen, nomor HP, `anak2`, `yg/utk/dll`, dan sejenisnya.
- Output **WAV 24 kHz, 16-bit, mono** di folder `hasil/`.

## Cara jalan

### Opsi A — Google Colab (paling mudah, GPU gratis)
1. Buka https://colab.research.google.com, lalu pilih **Upload** → `QreativaVoice_Colab.ipynb`
2. **Runtime → Change runtime type → T4 GPU**
3. **Runtime → Run all**, lalu klik link `gradio.live` yang muncul

### Opsi B — Laptop/PC Windows
1. Install Python 3.10–3.12 dari python.org (centang *Add to PATH*)
2. Double-click `install_windows.bat` (sekali saja)
3. Double-click `run_windows.bat`. Browser akan terbuka ke http://127.0.0.1:7860

Saat pertama kali generate, aplikasi akan download model (±2–3 GB).

| Hardware | Perkiraan kecepatan |
|---|---|
| GPU NVIDIA ≥6 GB VRAM | jauh lebih cepat dari real-time |
| Mac M1/M2/M3 | cukup cepat |
| CPU saja | bisa, tapi lambat (puluhan detik per kalimat) |

## Tips supaya logat Indonesianya natural
1. **Logat ikut referensi.** Untuk logat Indonesia yang paling natural, clone dari rekaman orang Indonesia yang berbicara bahasa Indonesia. Kalau referensinya bahasa Inggris, hasilnya akan terdengar seperti bule berbahasa Indonesia.
2. Referensi idealnya **5–10 detik**, satu orang, tanpa musik atau gema, dengan intonasi yang mirip dengan output yang diinginkan (ceria untuk iklan, tenang untuk narasi).
3. Isi transkrip referensi secara manual kalau sempat, karena lebih akurat daripada transkrip otomatis.
4. Buat beberapa preset, misalnya `promo_ceria`, `narasi_tenang`, dan `cs_ramah`, lalu simpan di Suara Tersimpan.
5. Pakai kualitas 32, atau 48 untuk hasil final. Pakai 16 untuk draft cepat.

## Lisensi dan etika
- Kode OmniVoice: Apache 2.0. Untuk pemakaian komersial (iklan klien, dsb.), cek ulang lisensi **bobot model** di halaman Hugging Face `k2-fsa/OmniVoice`, karena beberapa sumber menyebutnya non-komersial.
- Clone hanya suara sendiri atau suara orang yang sudah memberi izin. Meniru suara orang lain tanpa izin bisa bermasalah secara hukum (UU ITE dan UU PDP).

## Struktur
```
app.py              aplikasi (Gradio)
teks_id.py          normalisasi teks Indonesia (bisa dipakai terpisah)
QreativaVoice_Colab.ipynb versi Google Colab
hasil/              output .wav
suara_tersimpan/    preset suara clone (.pt)
```
