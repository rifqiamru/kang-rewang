// Posisi bersama antar-scene, supaya transisi (morph) nyambung mulus.
import { seeded } from "./motion";

export type Pt = { x: number; y: number };

// --- Scene 1: grid produk 6 x 4 -------------------------------------------
export const GRID_COLS = 6;
export const GRID_ROWS = 4;
export const GRID_GAP = 130;
export const GRID_CENTER: Pt = { x: 540, y: 1095 };

export const GRID_POSITIONS: Pt[] = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => {
  const c = i % GRID_COLS;
  const r = Math.floor(i / GRID_COLS);
  return {
    x: GRID_CENTER.x + (c - (GRID_COLS - 1) / 2) * GRID_GAP,
    y: GRID_CENTER.y + (r - (GRID_ROWS - 1) / 2) * GRID_GAP,
  };
});

// --- Scene 2: kerumunan -> 3 segmen ---------------------------------------
export const CROWD_POSITIONS: Pt[] = GRID_POSITIONS.map((_, i) => {
  const c = i % GRID_COLS;
  const r = Math.floor(i / GRID_COLS);
  return {
    x: 200 + c * 136 + (seeded(i + 1) - 0.5) * 70,
    y: 840 + r * 160 + (seeded(i + 40) - 0.5) * 80,
  };
});

/** 0 = target (aksen), 1 = putih, 2 = abu. Diacak supaya awalnya bercampur. */
export const CROWD_GROUP: number[] = (() => {
  const idx = GRID_POSITIONS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(seeded(i + 99) * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const g: number[] = [];
  idx.forEach((personIndex, order) => {
    g[personIndex] = Math.floor(order / 8);
  });
  return g;
})();

export const GROUP_CENTERS: Pt[] = [
  { x: 540, y: 905 },
  { x: 285, y: 1270 },
  { x: 795, y: 1270 },
];

/** Posisi tiap orang di dalam cluster (4 kolom x 2 baris). */
export const CLUSTER_POSITIONS: Pt[] = (() => {
  const counters = [0, 0, 0];
  return CROWD_GROUP.map((g) => {
    const k = counters[g]++;
    const c = k % 4;
    const r = Math.floor(k / 4);
    return {
      x: GROUP_CENTERS[g].x + (c - 1.5) * 78,
      y: GROUP_CENTERS[g].y + (r - 0.5) * 92,
    };
  });
})();

export const CROSSHAIR_RADIUS = 200;

// --- Scene 3: hati & nilai ------------------------------------------------
export const HEART_START: Pt = { x: GROUP_CENTERS[0].x, y: GROUP_CENTERS[0].y + 25 };
export const HEART_CENTER: Pt = { x: 540, y: 1085 };

export const VALUE_NODES: Pt[] = [
  { x: 225, y: 870 }, // bumi
  { x: 855, y: 870 }, // tangan
  { x: 540, y: 1360 }, // komunitas
];

// --- Scene 3 -> 4: jaringan digital ---------------------------------------
export const NETWORK_NODES: Pt[] = [
  HEART_CENTER,
  ...VALUE_NODES,
  ...Array.from({ length: 14 }, (_, i) => ({
    x: 130 + seeded(i + 300) * 820,
    y: 780 + seeded(i + 500) * 640,
  })),
];

export const NETWORK_EDGES: [number, number][] = (() => {
  const edges = new Set<string>();
  NETWORK_NODES.forEach((a, i) => {
    const nearest = NETWORK_NODES.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((n) => n.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    nearest.forEach(({ j }) => edges.add(i < j ? `${i}-${j}` : `${j}-${i}`));
  });
  return [...edges].map((e) => e.split("-").map(Number) as [number, number]);
})();

// --- Scene 4: phygital + 5A -----------------------------------------------
export const PHONE_POS: Pt = { x: 290, y: 905 };
export const STORE_POS: Pt = { x: 790, y: 905 };

export const PATH_NODES: Pt[] = [
  { x: 160, y: 1215 },
  { x: 350, y: 1330 },
  { x: 540, y: 1215 },
  { x: 730, y: 1330 },
  { x: 920, y: 1215 },
];

/** Titik tempat lima node menyusut (dan awal scene 5). */
export const CONVERGE_POINT: Pt = { x: 540, y: 960 };
