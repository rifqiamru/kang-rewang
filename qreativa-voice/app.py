"""Qreativa Voice — TTS bahasa Indonesia + clone voice, output .wav

Mesin: OmniVoice (k2-fsa) — model TTS zero-shot 600+ bahasa, termasuk Indonesia.
Jalankan:  python app.py   lalu buka http://127.0.0.1:7860
"""
import argparse
import os
import re
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import gradio as gr

from teks_id import normalisasi

ROOT = Path(__file__).parent
DIR_OUT = ROOT / "hasil"
DIR_VOICE = ROOT / "suara_tersimpan"
DIR_OUT.mkdir(exist_ok=True)
DIR_VOICE.mkdir(exist_ok=True)

GRADIO6 = int(gr.__version__.split(".")[0]) >= 6
MODEL_ID = os.environ.get("QREATIVA_MODEL") or os.environ.get("SUARAID_MODEL", "k2-fsa/OmniVoice")
_model = None


# ---------------------------------------------------------------- model ----
def _device():
    import torch
    if torch.cuda.is_available():
        return "cuda:0", torch.float16
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps", torch.float16
    return "cpu", torch.float32


def model():
    """Muat model sekali saja (lazy), supaya UI langsung terbuka."""
    global _model
    if _model is None:
        from omnivoice import OmniVoice
        dev, dtype = _device()
        print(f"[QreativaVoice] Memuat {MODEL_ID} di {dev} ... (pertama kali akan download ±2-3 GB)")
        _model = OmniVoice.from_pretrained(MODEL_ID, device_map=dev, dtype=dtype)
        print("[QreativaVoice] Model siap.")
    return _model


def _sr():
    return getattr(model(), "sampling_rate", None) or 24000


# --------------------------------------------------------------- helper ----
def _slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", s.strip().lower()).strip("_")
    return s[:40] or "suara"


def _simpan_wav(audio: np.ndarray, label: str) -> str:
    audio = np.asarray(audio, dtype=np.float32).squeeze()
    puncak = np.abs(audio).max() if audio.size else 0
    if puncak > 0.99:                       # cegah clipping
        audio = audio / puncak * 0.95
    nama = f"{time.strftime('%Y%m%d_%H%M%S')}_{_slug(label)}.wav"
    path = DIR_OUT / nama
    sf.write(path, audio, _sr(), subtype="PCM_16")   # WAV 16-bit, 24 kHz mono
    return str(path)


def _siapkan_teks(teks: str, pakai_normalisasi: bool) -> str:
    teks = (teks or "").strip()
    if not teks:
        raise gr.Error("Teks masih kosong.")
    return normalisasi(teks) if pakai_normalisasi else teks


def _kwargs_gen(kecepatan, kualitas):
    kw = {"language": "id", "num_step": int(kualitas)}
    if kecepatan and abs(kecepatan - 1.0) > 1e-3:
        kw["speed"] = float(kecepatan)
    return kw


def daftar_suara():
    return sorted(p.stem for p in DIR_VOICE.glob("*.pt"))


# ------------------------------------------------------------ handlers -----
def tts_bawaan(teks, gender, usia, nada, bisik, kecepatan, kualitas, norm):
    teks_final = _siapkan_teks(teks, norm)
    atribut = [a for a in (gender, usia, nada) if a and a != "otomatis"]
    if bisik:
        atribut.append("whisper")
    kw = _kwargs_gen(kecepatan, kualitas)
    if atribut:
        kw["instruct"] = ", ".join(atribut)
    audio = model().generate(text=teks_final, **kw)[0]
    return _simpan_wav(audio, "bawaan"), teks_final


def _transkrip(ref_audio):
    m = model()
    if getattr(m, "_asr_pipe", None) is None:
        gr.Info("Memuat Whisper untuk transkrip otomatis (sekali saja)...")
        m.load_asr_model()
    return m.transcribe(ref_audio).strip()


def transkrip_ref(ref_audio):
    if not ref_audio:
        raise gr.Error("Upload/rekam audio referensi dulu.")
    return _transkrip(ref_audio)


def _cek_ref(ref_audio, izin):
    if not izin:
        raise gr.Error("Centang pernyataan izin pemilik suara terlebih dahulu.")
    if not ref_audio:
        raise gr.Error("Upload/rekam audio referensi (3–10 detik).")
    info = sf.info(ref_audio)
    if info.duration < 2.5:
        raise gr.Error(f"Referensi terlalu pendek ({info.duration:.1f} dtk). Minimal ±3 detik.")
    if info.duration > 20:
        gr.Warning(f"Referensi {info.duration:.0f} dtk. Idealnya 3–10 dtk; potong bagian terbersih.")


def clone_generate(ref_audio, ref_text, izin, teks, kecepatan, kualitas, norm):
    _cek_ref(ref_audio, izin)
    teks_final = _siapkan_teks(teks, norm)
    ref_text = (ref_text or "").strip() or _transkrip(ref_audio)
    audio = model().generate(text=teks_final, ref_audio=ref_audio, ref_text=ref_text,
                             **_kwargs_gen(kecepatan, kualitas))[0]
    return _simpan_wav(audio, "clone"), ref_text, teks_final


def clone_simpan(ref_audio, ref_text, izin, nama):
    _cek_ref(ref_audio, izin)
    nama = _slug(nama or "")
    if not nama or nama == "suara":
        raise gr.Error("Isi nama suara, misal: rifqi_promo")
    ref_text = (ref_text or "").strip() or _transkrip(ref_audio)
    prompt = model().create_voice_clone_prompt(ref_audio=ref_audio, ref_text=ref_text)
    prompt.save(str(DIR_VOICE / f"{nama}.pt"))
    gr.Info(f"Suara '{nama}' tersimpan. Pakai di tab Suara Tersimpan.")
    return ref_text, gr.update(choices=daftar_suara(), value=nama)


def tersimpan_generate(nama, teks, kecepatan, kualitas, norm):
    if not nama:
        raise gr.Error("Pilih suara dulu.")
    from omnivoice import VoiceClonePrompt
    path = DIR_VOICE / f"{nama}.pt"
    if not path.exists():
        raise gr.Error("File suara tidak ditemukan. Klik Muat ulang.")
    teks_final = _siapkan_teks(teks, norm)
    prompt = VoiceClonePrompt.load(str(path))
    audio = model().generate(text=teks_final, voice_clone_prompt=prompt,
                             **_kwargs_gen(kecepatan, kualitas))[0]
    return _simpan_wav(audio, nama), teks_final


def hapus_suara(nama):
    if nama and (DIR_VOICE / f"{nama}.pt").exists():
        (DIR_VOICE / f"{nama}.pt").unlink()
        gr.Info(f"'{nama}' dihapus.")
    return gr.update(choices=daftar_suara(), value=None)


# ------------------------------------------------------------------ UI -----
CONTOH = ("Halo, selamat datang di HQ Tour. Paket wisata Jogja dua hari satu malam "
          "mulai Rp 750.000/org, sudah termasuk bus, hotel, dan makan. "
          "Info lebih lanjut, hubungi WA 081234567890 ya kak.")

CSS = """
.gradio-container {max-width: 980px !important; margin: auto;}
#judul h1 {font-weight: 650; letter-spacing: -0.02em; margin-bottom: 0}
#judul p {opacity: .65; margin-top: 4px}
footer {display: none !important}
button.secondary {background: #1f1f24 !important; color: #e7e7ea !important; border: 1px solid #2e2e35 !important}
code {background: #1f1f24 !important; color: #a7f3d0 !important; padding: 1px 6px; border-radius: 4px}
.nama-asli {font-size: .78em; opacity: .6; margin-left: .45em; font-style: italic}
.options {background: #1a1a1f !important; border: 1px solid #2e2e35 !important}
.options li {color: #e7e7ea !important}
.options li.active, .options li:hover {background: #24242a !important}
"""

TEMA = gr.themes.Base(
    primary_hue=gr.themes.colors.emerald,
    neutral_hue=gr.themes.colors.zinc,
    font=[gr.themes.GoogleFont("Inter"), "system-ui", "sans-serif"],
).set(
    body_background_fill="#0b0b0d", body_background_fill_dark="#0b0b0d",
    block_background_fill="#131316", block_background_fill_dark="#131316",
    block_border_color="#24242a", block_border_color_dark="#24242a",
    input_background_fill="#1a1a1f", input_background_fill_dark="#1a1a1f",
    body_text_color="#e7e7ea", body_text_color_dark="#e7e7ea",
)


# Nama karakter: (bahasa Indonesia, nama asli). Nilai yang dikirim ke model tetap nama asli;
# nama asli ditampilkan dengan font lebih kecil di sebelah nama Indonesianya.
SEP = " · "
GENDER = [("Otomatis", "otomatis"), ("Laki-laki", "male"), ("Perempuan", "female")]
USIA = [("Otomatis", "otomatis"), ("Anak-anak", "child"), ("Remaja", "teenager"),
        ("Dewasa muda", "young adult"), ("Paruh baya", "middle-aged"), ("Lansia", "elderly")]
NADA = [("Otomatis", "otomatis"), ("Sangat rendah", "very low pitch"), ("Rendah", "low pitch"),
        ("Sedang", "moderate pitch"), ("Tinggi", "high pitch"), ("Sangat tinggi", "very high pitch")]


def _opsi(daftar):
    """[(id, asli)] -> pilihan Gradio (label tampil, nilai asli)."""
    return [(i if a == "otomatis" else i + SEP + a, a) for i, a in daftar]


# Bungkus nama asli (teks setelah " · ") dalam <span class="nama-asli"> supaya tampil lebih kecil.
HEAD = """<script>
(() => {
  const SEP = " \u00b7 ";
  const proses = (node) => {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const daftar = [];
    while (w.nextNode()) if (w.currentNode.data.includes(SEP)) daftar.push(w.currentNode);
    for (const t of daftar) {
      const el = t.parentElement;
      if (!el || el.closest("textarea, input, #judul")) continue;
      const i = t.data.indexOf(SEP);
      const asli = t.data.slice(i + SEP.length);
      t.data = t.data.slice(0, i);
      let sp = t.nextSibling;
      if (!(sp && sp.classList && sp.classList.contains("nama-asli"))) {
        sp = document.createElement("span");
        sp.className = "nama-asli";
        t.after(sp);
      }
      sp.textContent = asli;
    }
  };
  const mulai = () => {
    proses(document.body);
    new MutationObserver((ms) => ms.forEach((m) =>
      proses(m.type === "characterData" ? m.target.parentNode || document.body : m.target)
    )).observe(document.body, {subtree: true, childList: true, characterData: true});
  };
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", mulai) : mulai();
})();
</script>"""


def _opsi_umum():
    with gr.Accordion("Pengaturan", open=False):
        with gr.Row():
            kecepatan = gr.Slider(0.7, 1.4, value=1.0, step=0.05, label="Kecepatan bicara")
            kualitas = gr.Slider(8, 48, value=32, step=4, label="Kualitas (langkah decoding)",
                                 info="16 = cepat, 32 = standar, 48 = paling halus")
        norm = gr.Checkbox(True, label="Normalisasi teks Indonesia (angka, Rp, %, jam, tanggal, singkatan)")
    return kecepatan, kualitas, norm


def build_ui():
    lama = {} if GRADIO6 else {"theme": TEMA, "css": CSS, "head": HEAD}
    with gr.Blocks(title="Qreativa Voice — TTS Indonesia", **lama) as demo:
        gr.Markdown("# Qreativa Voice\nText-to-speech bahasa Indonesia · clone voice · output WAV",
                    elem_id="judul")

        with gr.Tab("Suara Bawaan"):
            t1 = gr.Textbox(CONTOH, lines=6, label="Teks")
            with gr.Row():
                gender = gr.Dropdown(_opsi(GENDER), value="female", label="Jenis Kelamin")
                usia = gr.Dropdown(_opsi(USIA), value="young adult", label="Usia")
                nada = gr.Dropdown(_opsi(NADA), value="moderate pitch", label="Nada")
                bisik = gr.Checkbox(False, label="Berbisik" + SEP + "whisper")
            k1, q1, n1 = _opsi_umum()
            gr.Markdown("<small>Mode ini paling bagus untuk draft. Untuk logat Indonesia yang "
                        "paling natural & konsisten, pakai **Clone Voice** dengan rekaman orang "
                        "Indonesia.</small>")
            b1 = gr.Button("Buat Suara", variant="primary")
            o1 = gr.Audio(label="Hasil (.wav)", type="filepath")
            tn1 = gr.Textbox(label="Teks yang dibacakan (setelah normalisasi)", interactive=False)
            b1.click(tts_bawaan, [t1, gender, usia, nada, bisik, k1, q1, n1], [o1, tn1])

        with gr.Tab("Clone Voice"):
            gr.Markdown("**1. Referensi suara** — rekaman 3–10 detik, satu orang, tanpa musik, "
                        "berbahasa Indonesia.")
            ref = gr.Audio(sources=["upload", "microphone"], type="filepath",
                           label="Audio referensi")
            with gr.Row():
                ref_txt = gr.Textbox(label="Transkrip referensi (opsional, kosongkan = otomatis)",
                                     lines=2, scale=4)
                b_tr = gr.Button("Transkrip otomatis", scale=1)
            izin = gr.Checkbox(False, label="Saya pemilik suara ini atau sudah mendapat izin "
                                            "dari pemiliknya.")
            gr.Markdown("**2. Teks yang ingin diucapkan**")
            t2 = gr.Textbox(CONTOH, lines=5, label="Teks")
            k2, q2, n2 = _opsi_umum()
            b2 = gr.Button("Buat Suara Clone", variant="primary")
            o2 = gr.Audio(label="Hasil (.wav)", type="filepath")
            tn2 = gr.Textbox(label="Teks yang dibacakan", interactive=False)
            with gr.Accordion("Simpan suara ini ke perpustakaan", open=False):
                with gr.Row():
                    nama_baru = gr.Textbox(label="Nama suara", placeholder="contoh: rifqi_promo",
                                           scale=3)
                    b_save = gr.Button("Simpan", scale=1)

        with gr.Tab("Suara Tersimpan"):
            with gr.Row():
                pilih = gr.Dropdown(daftar_suara(), label="Pilih suara", scale=4)
                b_reload = gr.Button("Muat ulang", scale=1)
                b_del = gr.Button("Hapus", variant="stop", scale=1)
            t3 = gr.Textbox(CONTOH, lines=6, label="Teks")
            k3, q3, n3 = _opsi_umum()
            b3 = gr.Button("Buat Suara", variant="primary")
            o3 = gr.Audio(label="Hasil (.wav)", type="filepath")
            tn3 = gr.Textbox(label="Teks yang dibacakan", interactive=False)

        # events clone / tersimpan
        b_tr.click(transkrip_ref, ref, ref_txt)
        b2.click(clone_generate, [ref, ref_txt, izin, t2, k2, q2, n2], [o2, ref_txt, tn2])
        b_save.click(clone_simpan, [ref, ref_txt, izin, nama_baru], [ref_txt, pilih])
        b_reload.click(lambda: gr.update(choices=daftar_suara()), None, pilih)
        b_del.click(hapus_suara, pilih, pilih)
        b3.click(tersimpan_generate, [pilih, t3, k3, q3, n3], [o3, tn3])

        gr.Markdown(f"<small>Semua file WAV tersimpan di folder <code>{DIR_OUT.name}/</code>. "
                    "Gunakan clone voice hanya untuk suara sendiri atau yang sudah memberi izin.</small>")
    return demo


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--share", action="store_true", help="buat link publik (untuk Colab)")
    ap.add_argument("--port", type=int, default=7860)
    ap.add_argument("--preload", action="store_true", help="muat model saat start")
    args = ap.parse_args()
    if args.preload:
        model()
    app = build_ui()
    app.queue(default_concurrency_limit=1)
    kw = dict(server_name="0.0.0.0" if args.share else "127.0.0.1",
              server_port=args.port, share=args.share,
              allowed_paths=[str(DIR_OUT)])
    if GRADIO6:                             # Gradio 6: theme/css pindah ke launch()
        kw.update(theme=TEMA, css=CSS, head=HEAD)
    app.launch(**kw)
