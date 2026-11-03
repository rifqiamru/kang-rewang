// ===========================================================================
// NASKAH VOICE OVER (Bahasa Indonesia) + TIMING
// ---------------------------------------------------------------------------
// - `start` / `end` dalam detik, ABSOLUT dari awal video (0–60).
// - Rekam satu file per scene, simpan sebagai public/vo/scene-<id>.wav
//   (atau ganti `file`). File diputar mulai `fileStart` detik.
//   Lalu set AUDIO.voEnabled = true di src/config.ts.
// - Subtitle dibuat otomatis dari `segments` (dipecah per <= 6 kata).
//   Kalau rekamanmu lebih cepat/lambat, cukup geser start/end di sini.
// ===========================================================================

export type VoSegment = { text: string; start: number; end: number };

export type VoScene = {
  id: number;
  /** File rekaman relatif ke public/. */
  file: string;
  /** Detik absolut kapan file VO mulai diputar. */
  fileStart: number;
  /** Subtitle tidak ditampilkan jika teksnya sudah sama dengan teks on-screen. */
  showSubtitle: boolean;
  segments: VoSegment[];
};

export const VO: VoScene[] = [
  {
    id: 0,
    file: "vo/scene-0.wav",
    fileStart: 0.5,
    showSubtitle: false, // identik dengan teks on-screen hook
    segments: [
      { text: "Banyak UMKM masih jualan pakai cara tahun 1960-an.", start: 0.5, end: 4.4 },
    ],
  },
  {
    id: 1,
    file: "vo/scene-1.wav",
    fileStart: 5.3,
    showSubtitle: true,
    segments: [
      { text: "Marketing 1.0 lahir di era industri.", start: 5.3, end: 7.6 },
      { text: "Fokusnya produk: dibuat massal, dijual ke siapa saja.", start: 7.9, end: 11.5 },
      { text: "Pertanyaannya cuma satu: apa yang kita jual?", start: 11.9, end: 15.0 },
    ],
  },
  {
    id: 2,
    file: "vo/scene-2.wav",
    fileStart: 17.3,
    showSubtitle: true,
    segments: [
      { text: "Lalu pelanggan punya banyak pilihan.", start: 17.3, end: 19.5 },
      {
        text: "Marketing 2.0 mulai bertanya: siapa target kita, dan apa yang mereka mau?",
        start: 19.8,
        end: 24.4,
      },
      { text: "Tapi pelanggan masih dianggap target, bukan manusia utuh.", start: 24.7, end: 28.4 },
    ],
  },
  {
    id: 3,
    file: "vo/scene-3.wav",
    fileStart: 29.4,
    showSubtitle: true,
    segments: [
      {
        text: "Marketing 3.0 melihat pelanggan sebagai manusia dengan hati dan nilai.",
        start: 29.4,
        end: 33.6,
      },
      { text: "Brand dipilih karena misi dan kepeduliannya.", start: 33.9, end: 36.7 },
      { text: "Pertanyaannya: apa yang kita perjuangkan?", start: 37.0, end: 39.9 },
    ],
  },
  {
    id: 4,
    file: "vo/scene-4.wav",
    fileStart: 41.3,
    showSubtitle: true,
    segments: [
      { text: "Marketing 4.0 menyatukan digital dan tatap muka.", start: 41.3, end: 44.1 },
      {
        text: "Pelanggan melewati lima tahap: kenal, tertarik, bertanya, membeli, lalu merekomendasikan.",
        start: 44.4,
        end: 49.3,
      },
      {
        text: "Teknologi mempercepat, tapi sentuhan manusia membuat orang setia.",
        start: 49.6,
        end: 52.8,
      },
    ],
  },
  {
    id: 5,
    file: "vo/scene-5.wav",
    fileStart: 53.1,
    showSubtitle: true,
    // Catatan: scene ini padat (~28 kata dalam 7 detik). Bicara cepat
    // atau pertimbangkan meringkas naskah.
    segments: [
      { text: "Produk, pelanggan, nilai, koneksi.", start: 53.1, end: 54.9 },
      { text: "Kebanyakan UMKM masih di 1.0 atau 2.0.", start: 55.0, end: 56.6 },
      { text: "Qreativa membantu naik ke 3.0 dan 4.0.", start: 56.7, end: 58.2 },
      { text: "Mau tahu bisnis kamu ada di versi berapa? Chat kami.", start: 58.3, end: 59.9 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Subtitle otomatis
// ---------------------------------------------------------------------------
export type SubtitleCue = { text: string; start: number; end: number };

const MAX_WORDS = 6;

/** Pecah kalimat jadi potongan <= MAX_WORDS kata, utamakan jeda tanda baca. */
const chunkText = (text: string): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const phrases: string[][] = [];
  let current: string[] = [];
  for (const w of words) {
    current.push(w);
    if (/[,.:;?!]$/.test(w)) {
      phrases.push(current);
      current = [];
    }
  }
  if (current.length) phrases.push(current);

  // Pecah frasa yang terlalu panjang secara merata.
  const split: string[][] = [];
  for (const p of phrases) {
    if (p.length <= MAX_WORDS) {
      split.push(p);
      continue;
    }
    const parts = Math.ceil(p.length / MAX_WORDS);
    const size = Math.ceil(p.length / parts);
    for (let i = 0; i < p.length; i += size) split.push(p.slice(i, i + size));
  }

  // Gabungkan frasa pendek berurutan selama total <= MAX_WORDS.
  const merged: string[][] = [];
  for (const p of split) {
    const last = merged[merged.length - 1];
    if (last && last.length + p.length <= MAX_WORDS) last.push(...p);
    else merged.push([...p]);
  }
  return merged.map((m) => m.join(" "));
};

/** Semua cue subtitle (detik absolut), waktunya dibagi proporsional panjang teks. */
export const SUBTITLES: SubtitleCue[] = VO.filter((s) => s.showSubtitle).flatMap((scene) =>
  scene.segments.flatMap((seg) => {
    const chunks = chunkText(seg.text);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let t = seg.start;
    return chunks.map((c) => {
      const d = ((seg.end - seg.start) * c.length) / total;
      const cue = { text: c, start: t, end: t + d };
      t += d;
      return cue;
    });
  }),
);
