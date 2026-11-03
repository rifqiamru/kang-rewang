import React from "react";
import { useCurrentFrame } from "remotion";
import { Era, FONT, LAYOUT } from "../theme";
import { mix, progress } from "../lib/motion";

type Props = {
  /** Contoh "2.0" */
  value: string;
  color: string;
  era: Era;
  /** Detik (relatif scene) mulai animasi masuk. null = langsung tampil. */
  enterAt?: number | null;
  /** Detik (relatif scene) mulai animasi keluar. null = tidak keluar. */
  exitAt?: number | null;
  /** Ganti titik desimal dengan elemen lain (dipakai di hook). */
  dotSlot?: React.ReactNode;
  /** 0..1: digit "keluar" dari titik desimal (dipakai di hook). */
  digitReveal?: number;
};

/**
 * Angka versi besar & tebal. Selalu dirender di slot yang sama (LAYOUT.number)
 * supaya posisinya konsisten di semua scene.
 */
export const BigNumber: React.FC<Props> = ({
  value,
  color,
  era,
  enterAt = null,
  exitAt = null,
  dotSlot,
  digitReveal = 1,
}) => {
  const frame = useCurrentFrame();
  const [major, minor] = value.split(".");
  const chars: { ch: string; kind: "digit" | "dot"; side: -1 | 0 | 1 }[] = [
    { ch: major, kind: "digit", side: -1 },
    { ch: ".", kind: "dot", side: 0 },
    { ch: minor, kind: "digit", side: 1 },
  ];

  const charStyle = (i: number): React.CSSProperties => {
    const stagger = era === 4 ? i * 0.05 : era === 2 ? i * 0.03 : 0;
    const pin = enterAt === null ? 1 : progress(frame, enterAt + stagger, era);
    const pout = exitAt === null ? 0 : progress(frame, exitAt + stagger * 0.5, era, era === 3 ? 0.6 : 0.25);
    let transform = "";
    let filter = "none";
    let opacity = pin * (1 - pout);
    switch (era) {
      case 0:
      case 1:
        transform = `translateY(${mix(40, 0, pin) + mix(0, -40, pout)}px)`;
        break;
      case 2:
        transform = `translateY(${mix(110, 0, pin) + mix(0, -110, pout)}%)`;
        // slot di-clip (overflow hidden), jadi angka "snap" masuk dari bawah
        opacity = pin <= 0 || pout >= 1 ? 0 : 1;
        break;
      case 3:
        transform = `scale(${mix(1.08, 1, pin) * mix(1, 0.96, pout)})`;
        filter = `blur(${(1 - pin) * 18 + pout * 14}px)`;
        break;
      case 4:
        transform = `translateX(${mix(-36, 0, pin) + mix(0, 36, pout)}px) skewX(${mix(-12, 0, pin)}deg)`;
        break;
    }
    return { display: "inline-block", transform, filter, opacity };
  };

  return (
    <div
      style={{
        position: "absolute",
        top: LAYOUT.number.top,
        left: 0,
        width: "100%",
        height: LAYOUT.number.height,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: era === 2 ? "hidden" : "visible",
        fontFamily: FONT.family,
        fontWeight: FONT.weight.black,
        fontSize: LAYOUT.number.fontSize,
        lineHeight: 1,
        letterSpacing: "-0.04em",
        fontVariantNumeric: "tabular-nums",
        color,
      }}
    >
      {chars.map((c, i) => {
        if (c.kind === "dot") {
          return (
            <span key={i} style={{ ...charStyle(i), position: "relative", width: "0.24em", height: "1em" }}>
              {dotSlot ?? (
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: "0.135em",
                    width: "0.15em",
                    height: "0.15em",
                    marginLeft: "-0.075em",
                    borderRadius: "50%",
                    background: color,
                  }}
                />
              )}
            </span>
          );
        }
        const s = charStyle(i);
        const reveal = digitReveal;
        return (
          <span
            key={i}
            style={{
              ...s,
              opacity: (s.opacity as number) * reveal,
              transform: `${s.transform} translateX(${(1 - reveal) * -c.side * 0.35}em) scaleX(${mix(0.2, 1, reveal)})`,
              transformOrigin: c.side < 0 ? "right center" : "left center",
            }}
          >
            {c.ch}
          </span>
        );
      })}
    </div>
  );
};

/** Ukuran titik desimal (em) — dipakai hook untuk animasi garis -> titik. */
export const DOT_SIZE_EM = 0.15;
