import { loadFont } from "@remotion/google-fonts/Inter";

// ---------------------------------------------------------------------------
// Video format
// ---------------------------------------------------------------------------
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_SEC = 60;

/** Satu-satunya helper konversi detik -> frame. Semua timing ditulis dalam detik. */
export const sec = (seconds: number): number => Math.round(seconds * FPS);

// ---------------------------------------------------------------------------
// Layout (px). Safe area 150px atas & bawah untuk UI Instagram/TikTok.
// ---------------------------------------------------------------------------
export const SAFE = {
  top: 150,
  bottom: 150,
  side: 80,
} as const;

export const LAYOUT = {
  /** Angka versi: selalu di posisi ini di semua scene. */
  number: { top: 200, height: 300, fontSize: 300 },
  /** Slot KeyText di bawah angka. */
  keyText: { top: 540, height: 150 },
  /** Area ilustrasi. */
  stage: { top: 730, bottom: 1460 },
  /** Subtitle (di dalam safe area bawah). */
  subtitle: { bottom: SAFE.bottom + 40, maxWidth: 900 },
} as const;

// ---------------------------------------------------------------------------
// Warna
// ---------------------------------------------------------------------------
export const COLORS = {
  bg: "#0B0B0C",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.62)",
  line: "rgba(255,255,255,0.14)",
  lineSoft: "rgba(255,255,255,0.07)",
  /** Aksen dasar brand. */
  accent: "#FF6B35",
} as const;

export type Era = 0 | 1 | 2 | 3 | 4;

/** Aksen bergeser sedikit per versi. Index = era (0 = hook memakai warna 1.0). */
export const ERA_ACCENT: Record<Era, string> = {
  0: "#B98A72", // hook: sama dengan 1.0
  1: "#B98A72", // 1.0 abu-oranye
  2: COLORS.accent, // 2.0 oranye
  3: "#FF8650", // 3.0 oranye hangat
  4: "#FF9A3C", // 4.0 oranye terang
};

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------
const inter = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const FONT = {
  family: `${inter.fontFamily}, "Plus Jakarta Sans", system-ui, sans-serif`,
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
  size: {
    keyTitle: 66,
    keyBody: 58,
    label: 34,
    subtitle: 42,
  },
} as const;

// ---------------------------------------------------------------------------
// Timing scene (detik). Total 60 detik.
// ---------------------------------------------------------------------------
export const SCENES = {
  hook: { start: 0, duration: 5 },
  m1: { start: 5, duration: 12 },
  m2: { start: 17, duration: 12 },
  m3: { start: 29, duration: 12 },
  m4: { start: 41, duration: 12 },
  cta: { start: 53, duration: 7 },
} as const;

export type SceneKey = keyof typeof SCENES;
export const SCENE_ORDER: SceneKey[] = ["hook", "m1", "m2", "m3", "m4", "cta"];
