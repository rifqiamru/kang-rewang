import { Easing, interpolate } from "remotion";
import { Era, FPS, sec } from "../theme";

/**
 * Karakter gerak per era.
 *  1.0: kaku, linear, bergerak patah-patah (stepped) seperti mesin.
 *  2.0: snap cepat & presisi.
 *  3.0: organik, mengalir, easing lembut.
 *  4.0: cepat, tajam, terhubung.
 */
export const ERA_EASING: Record<Era, (t: number) => number> = {
  0: Easing.linear,
  1: Easing.linear,
  2: Easing.bezier(0.16, 1, 0.3, 1),
  3: Easing.bezier(0.45, 0.05, 0.25, 1),
  4: Easing.bezier(0.05, 0.9, 0.1, 1),
};

/** Durasi default animasi per era (detik). */
export const ERA_DURATION: Record<Era, number> = {
  0: 0.6,
  1: 0.6,
  2: 0.28,
  3: 1.1,
  4: 0.22,
};

/** Langkah frame untuk efek patah-patah era 1.0. */
const STEP_FRAMES = 4;

/** Frame yang "dipatah-patahkan" agar gerakan terasa seperti mesin. */
export const stepFrame = (frame: number, step = STEP_FRAMES) =>
  Math.floor(frame / step) * step;

/**
 * Progress 0..1 untuk animasi yang mulai di `startSec` (detik, relatif scene),
 * dengan durasi `durSec` dan karakter gerak sesuai era.
 */
export const progress = (
  frame: number,
  startSec: number,
  era: Era,
  durSec: number = ERA_DURATION[era],
): number => {
  const f = era === 1 ? stepFrame(frame) : frame;
  const start = sec(startSec);
  const end = start + Math.max(1, sec(durSec));
  return interpolate(f, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ERA_EASING[era],
  });
};

/** Linear-interpolate a -> b dengan t 0..1. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Waktu dalam detik dari frame. */
export const toSec = (frame: number) => frame / FPS;

/** Random deterministik (seeded) untuk posisi yang stabil antar-render. */
export const seeded = (seed: number) => {
  const x = Math.sin(seed * 9301.17 + 49297.3) * 233280.5;
  return x - Math.floor(x);
};
