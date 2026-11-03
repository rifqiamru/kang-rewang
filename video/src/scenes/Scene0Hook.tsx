import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BigNumber, DOT_SIZE_EM } from "../components/BigNumber";
import { KeyText } from "../components/KeyText";
import { CONTENT } from "../content";
import { ERA_ACCENT, LAYOUT, sec } from "../theme";

/**
 * SCENE 0 – HOOK (0–5 dtk)
 * Layar gelap. Garis aksen tipis memanjang, lalu menarik diri menjadi
 * titik desimal, dan digit "1" & "0" keluar dari titik itu -> "1.0".
 */
export const Scene0Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const accent = ERA_ACCENT[1];
  const dotPx = LAYOUT.number.fontSize * DOT_SIZE_EM;

  const k = (a: number, b: number, ease = Easing.inOut(Easing.cubic)) =>
    interpolate(frame, [sec(a), sec(b)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });

  const draw = k(0.2, 0.95, Easing.out(Easing.cubic)); // garis memanjang
  const pull = k(1.15, 1.7, Easing.in(Easing.cubic)); // garis menarik diri
  const reveal = k(1.65, 2.25, Easing.out(Easing.back(1.4))); // digit keluar

  const lineW = interpolate(draw, [0, 1], [0, 720]) * (1 - pull) + dotPx * pull;
  const lineH = 4 + (dotPx - 4) * Math.pow(pull, 3);

  const line = (
    <span
      style={{
        position: "absolute",
        left: "50%",
        bottom: `${0.135 + DOT_SIZE_EM / 2}em`,
        width: lineW,
        height: lineH,
        transform: `translate(-50%, 50%)`,
        borderRadius: Math.max(2, lineH / 2),
        background: accent,
        boxShadow: `0 0 ${24 * (1 - pull)}px ${accent}66`,
      }}
    />
  );

  return (
    <AbsoluteFill>
      <BigNumber
        value={CONTENT.hook.number}
        color={accent}
        era={1}
        dotSlot={line}
        digitReveal={Math.max(0, reveal)}
      />
      <KeyText lines={CONTENT.hook.lines} era={1} accent={accent} top={760} height={260} fontScale={1.3} />
    </AbsoluteFill>
  );
};
