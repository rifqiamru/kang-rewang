// ===========================================================================
// KONFIGURASI YANG PERLU DIISI / DIATUR — semua di satu tempat.
// ===========================================================================

/** Nomor WhatsApp yang tampil di CTA akhir. Ganti dengan nomor asli. */
export const WHATSAPP_NUMBER = "0812-0000-0000";

/** Nama brand (logo teks). */
export const BRAND_NAME = "QREATIVA";

/** Tampilkan subtitle otomatis dari src/vo.ts. */
export const SHOW_SUBTITLES = true;

/**
 * Audio. Volume 0..1. File relatif ke folder `public/`.
 * Musik & SFX placeholder dibuat sintetis oleh `npm run audio`
 * (tanpa musik berhak cipta). Ganti file-nya kapan saja dengan nama yang sama.
 */
export const AUDIO = {
  master: 1,
  music: 0.22,
  sfx: 0.5,
  vo: 1,
  /** Fade in/out musik (detik). */
  musicFadeIn: 1.5,
  musicFadeOut: 2,
  /** Set true setelah file rekaman VO ada di public/vo/ (lihat src/vo.ts). */
  voEnabled: false,
  files: {
    music: "audio/music-placeholder.wav",
    whoosh: "audio/sfx-whoosh.wav",
    tick: "audio/sfx-tick.wav",
    rise: "audio/sfx-rise.wav",
  },
} as const;
