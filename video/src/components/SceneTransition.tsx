import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Era } from "../theme";
import { mix, progress } from "../lib/motion";

type Props = {
  era: Era;
  /** Durasi scene (detik). */
  duration: number;
  /** Lama transisi masuk (detik). 0 = tanpa transisi masuk. */
  enter?: number;
  /** Lama transisi keluar (detik). 0 = tanpa transisi keluar. */
  exit?: number;
  children: React.ReactNode;
};

/**
 * Pembungkus layer scene: masuk/keluar dengan karakter gerak era.
 *  1.0 patah-patah linear, 2.0 snap, 3.0 lembut + blur, 4.0 cepat + geser.
 * Elemen yang "morph" ke scene berikutnya sebaiknya diletakkan di luar
 * pembungkus ini supaya tetap terlihat saat pergantian scene.
 */
export const SceneTransition: React.FC<Props> = ({ era, duration, enter = 0.4, exit = 0.4, children }) => {
  const frame = useCurrentFrame();
  const pin = enter > 0 ? progress(frame, 0, era, enter) : 1;
  const pout = exit > 0 ? progress(frame, duration - exit, era === 1 ? 1 : 3, exit) : 0;
  const o = pin * (1 - pout);

  let transform = "none";
  let filter = "none";
  if (era === 2) transform = `scale(${mix(0.94, 1, pin) * mix(1, 1.04, pout)})`;
  if (era === 3) filter = `blur(${(1 - pin) * 12 + pout * 12}px)`;
  if (era === 4) transform = `translateX(${mix(40, 0, pin) + mix(0, -40, pout)}px)`;
  if (era <= 1) transform = `translateY(${mix(24, 0, pin)}px)`;

  return <AbsoluteFill style={{ opacity: o, transform, filter }}>{children}</AbsoluteFill>;
};
