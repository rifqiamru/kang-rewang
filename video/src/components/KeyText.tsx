import React from "react";
import { useCurrentFrame } from "remotion";
import { KeyLine } from "../content";
import { COLORS, Era, FONT, LAYOUT } from "../theme";
import { mix, progress, toSec } from "../lib/motion";

type Props = {
  lines: readonly KeyLine[];
  era: Era;
  accent: string;
  /** Override posisi (default: slot KeyText di bawah angka). */
  top?: number;
  height?: number;
  fontScale?: number;
};

/** Pecah "*kata*" menjadi token kata dengan flag aksen. */
export const parseAccent = (text: string) => {
  const tokens: { word: string; accent: boolean }[] = [];
  let accent = false;
  text.split(/\s+/).forEach((raw) => {
    let w = raw;
    let on = accent;
    if (w.startsWith("*")) {
      on = true;
      w = w.slice(1);
    }
    let closes = false;
    if (w.endsWith("*")) {
      closes = true;
      w = w.slice(0, -1);
    }
    tokens.push({ word: w, accent: on });
    accent = on && !closes;
  });
  return tokens;
};

const STAGGER: Record<Era, number> = { 0: 0, 1: 0, 2: 0.045, 3: 0.09, 4: 0.025 };

const Line: React.FC<{ line: KeyLine; era: Era; accent: string; fontScale: number }> = ({
  line,
  era,
  accent,
  fontScale,
}) => {
  const frame = useCurrentFrame();
  const tokens = parseAccent(line.text);
  const exitDur = era === 3 ? 0.5 : 0.22;
  const pout = progress(frame, line.to - exitDur, era === 1 ? 1 : 2, exitDur);

  // Era 1.0: seluruh baris muncul seperti dicetak mesin (wipe patah-patah).
  const wipe = era === 1 || era === 0 ? progress(frame, line.from, 1, 0.55) : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        fontFamily: FONT.family,
        fontSize: (line.kind === "title" ? FONT.size.keyTitle : FONT.size.keyBody) * fontScale * (line.scale ?? 1),
        fontWeight: line.kind === "title" ? FONT.weight.semibold : FONT.weight.regular,
        lineHeight: 1.18,
        letterSpacing: "-0.01em",
        color: COLORS.text,
        textAlign: "center",
        clipPath: era <= 1 ? `inset(0 ${(1 - wipe) * 100}% 0 0)` : undefined,
        opacity: 1 - pout,
        transform: `translateY(${mix(0, -18, pout)}px)`,
        filter: era === 3 ? `blur(${pout * 8}px)` : undefined,
      }}
    >
      <div style={{ textWrap: "balance", width: "100%" } as React.CSSProperties}>
      {tokens.map((t, i) => {
        const p = era <= 1 ? 1 : progress(frame, line.from + i * STAGGER[era], era);
        let style: React.CSSProperties = {};
        if (era === 2) style = { transform: `translateY(${mix(0.9, 0, p)}em)`, opacity: p > 0 ? 1 : 0 };
        if (era === 3)
          style = {
            transform: `translateY(${mix(28, 0, p)}px)`,
            opacity: p,
            filter: `blur(${(1 - p) * 10}px)`,
          };
        if (era === 4)
          style = {
            transform: `translateX(${mix(-28, 0, p)}px)`,
            opacity: p,
          };
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: era === 2 ? "hidden" : "visible",
              color: t.accent ? accent : COLORS.text,
              fontWeight: t.accent ? FONT.weight.bold : undefined,
            }}
          >
            <span style={{ display: "inline-block", ...style }}>{t.word}</span>
          </span>
        );
      }).flatMap((el, i) => (i === 0 ? [el] : [" ", el]))}
      </div>
    </div>
  );
};

/**
 * Teks kunci dengan animasi masuk/keluar sesuai karakter era.
 * Setiap baris tampil di slot yang sama, bergantian.
 */
export const KeyText: React.FC<Props> = ({
  lines,
  era,
  accent,
  top = LAYOUT.keyText.top,
  height = LAYOUT.keyText.height,
  fontScale = 1,
}) => {
  const frame = useCurrentFrame();
  const t = toSec(frame);
  return (
    <div style={{ position: "absolute", top, left: 0, width: "100%", height }}>
      {lines
        .filter((l) => t >= l.from - 0.01 && t <= l.to + 0.05)
        .map((l) => (
          <Line key={l.text} line={l} era={era} accent={accent} fontScale={fontScale} />
        ))}
    </div>
  );
};
