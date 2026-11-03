// ===========================================================================
// Teks on-screen (maks. 7 kata per layar). Bungkus kata aksen dengan *...*
// Waktu `from` / `to` dalam detik, RELATIF terhadap awal scene.
// Naskah voice over ada di src/vo.ts.
// ===========================================================================

export type KeyLine = {
  text: string;
  from: number;
  to: number;
  /** "title" = semibold, "body" = regular (keterangan). */
  kind: "title" | "body";
  /** Skala ukuran font opsional (untuk baris yang panjang). */
  scale?: number;
};

export const CONTENT = {
  hook: {
    number: "1.0",
    lines: [
      { text: "Banyak UMKM masih jualan", from: 0.4, to: 1.85, kind: "body" },
      { text: "pakai cara tahun *1960-an.*", from: 1.9, to: 4.75, kind: "title" },
    ] as KeyLine[],
  },
  m1: {
    number: "1.0",
    lines: [
      { text: "*1.0* – Fokus ke produk", from: 0.3, to: 5.15, kind: "title" },
      { text: "Dibuat banyak, dijual ke semua.", from: 5.25, to: 11.3, kind: "body" },
    ] as KeyLine[],
  },
  m2: {
    number: "2.0",
    lines: [
      { text: "*2.0* – Fokus ke pelanggan", from: 0.35, to: 5.25, kind: "title" },
      { text: "Segmentasi • Targeting • Positioning", from: 5.35, to: 11.3, kind: "body", scale: 0.74 },
    ] as KeyLine[],
  },
  m3: {
    number: "3.0",
    lines: [
      { text: "*3.0* – Fokus ke nilai", from: 0.6, to: 4.7, kind: "title" },
      { text: "Brand dengan *misi,* bukan cuma produk.", from: 4.8, to: 11.2, kind: "body" },
    ] as KeyLine[],
  },
  m4: {
    number: "4.0",
    lines: [
      { text: "*4.0* – Offline + Online", from: 0.3, to: 4.4, kind: "title" },
      { text: "*5A* Customer Path", from: 4.55, to: 11.3, kind: "title" },
    ] as KeyLine[],
    path: ["Aware", "Appeal", "Ask", "Act", "Advocate"],
    /** Detik (relatif scene) tiap node 5A muncul — sinkron dengan VO. */
    pathTimes: [5.0, 5.75, 6.5, 7.25, 8.0],
  },
  cta: {
    recap: [
      { number: "1.0", label: "Produk" },
      { number: "2.0", label: "Pelanggan" },
      { number: "3.0", label: "Nilai" },
      { number: "4.0", label: "Koneksi" },
    ],
    /** Detik (relatif scene) tiap angka recap terisi. */
    recapTimes: [0.4, 0.9, 1.4, 1.9],
    question: ["Dari *1.0* ke *4.0,*", "mulainya dari mana?"],
    ctaLabel: "Chat WhatsApp",
  },
} as const;
