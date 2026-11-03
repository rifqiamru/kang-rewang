# Evolusi Marketing 1.0 → 4.0 — Qreativa

Video motion graphics vertikal 1080×1920, 30 fps, 60 detik, dibuat dengan Remotion (React + TypeScript).

## Menjalankan

```bash
cd video
npm install
npm run audio      # buat ulang musik/SFX placeholder (opsional, file sudah ada)
npm run studio     # preview interaktif di browser
npm run stills     # still frame di titik tengah tiap scene -> out/stills/
npm run render     # MP4 final -> out/marketing-evolution.mp4
```

Kalau Remotion tidak bisa mengunduh Chrome Headless Shell, tambahkan
`--browser-executable=/path/ke/chrome` ke perintah render/still.

## Yang perlu diisi

| Apa | Di mana |
| --- | --- |
| Nomor WhatsApp | `src/config.ts` → `WHATSAPP_NUMBER` |
| Rekaman VO | Rekam per scene sesuai naskah di `src/vo.ts`, simpan `public/vo/scene-0.wav` … `scene-5.wav`, lalu set `AUDIO.voEnabled = true` di `src/config.ts`. Geser `start`/`end` di `src/vo.ts` bila tempo rekaman berbeda — subtitle ikut menyesuaikan. |
| Musik & SFX | Ganti file di `public/audio/` (nama sama). Volume semua di `src/config.ts` → `AUDIO`. |

## Struktur

```
src/
  theme.ts          warna, font, layout/safe area, timing scene, helper sec()
  content.ts        teks on-screen (maks. 7 kata per layar)
  vo.ts             naskah VO + timing, generator subtitle otomatis
  config.ts         nomor WhatsApp, brand, volume audio, toggle subtitle
  scenes/           Scene0Hook … Scene5Cta (satu komponen per scene)
  components/       BigNumber, KeyText, SceneTransition, Subtitles, AudioLayer, Icons
  lib/              motion (easing per era), layout (posisi bersama antar-scene)
scripts/
  generate-audio.mjs  audio placeholder sintetis (bebas hak cipta)
  render-stills.mjs   render still frame tengah tiap scene
```

## Karakter gerak per era

- **1.0** – linear dan patah-patah (frame di-step tiap 4 frame), grid.
- **2.0** – snap cepat dan presisi (easing expo-out pendek).
- **3.0** – organik, easing lembut, blur, garis melengkung yang bernapas.
- **4.0** – sangat cepat, stagger rapat, garis jaringan dan pulsa data.
