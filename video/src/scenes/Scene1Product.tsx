import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BigNumber } from "../components/BigNumber";
import { BoxIcon, FactoryIcon } from "../components/Icons";
import { KeyText } from "../components/KeyText";
import { SceneTransition } from "../components/SceneTransition";
import { CONTENT } from "../content";
import { GRID_GAP, GRID_POSITIONS } from "../lib/layout";
import { mix, progress, seeded, stepFrame, toSec } from "../lib/motion";
import { COLORS, ERA_ACCENT, LAYOUT, SCENES } from "../theme";

const ERA = 1 as const;
const DUR = SCENES.m1.duration;
const BOX = 84;

/** Grid latar tipis — estetika era industri yang kaku. */
const BackgroundGrid: React.FC<{ opacity: number }> = ({ opacity }) => {
  const lines = [];
  for (let x = 540 - GRID_GAP * 4; x <= 540 + GRID_GAP * 4; x += GRID_GAP / 2)
    lines.push(<line key={`v${x}`} x1={x} y1={LAYOUT.stage.top} x2={x} y2={LAYOUT.stage.bottom} />);
  for (let y = LAYOUT.stage.top + 15; y <= LAYOUT.stage.bottom; y += GRID_GAP / 2)
    lines.push(<line key={`h${y}`} x1={60} y1={y} x2={1020} y2={y} />);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", opacity }}>
      <g stroke={COLORS.lineSoft} strokeWidth={1.5}>
        {lines}
      </g>
    </svg>
  );
};

/**
 * SCENE 1 – MARKETING 1.0: PRODUCT-CENTRIC (5–17 dtk)
 * Pabrik + ban berjalan -> produk identik berbaris di grid
 * -> produk pecah menjadi titik (yang jadi orang di scene 2).
 */
export const Scene1Product: React.FC = () => {
  const frame = useCurrentFrame();
  const sf = stepFrame(frame); // semua gerakan di scene ini patah-patah
  const t = toSec(sf);
  const accent = ERA_ACCENT[1];

  // Fase A: pabrik & ban berjalan (0 – 5.6)
  const factoryIn = progress(frame, 0.2, ERA, 0.8);
  const factoryOut = progress(frame, 5.4, ERA, 0.6);
  const beltY = 1150;
  const beltX0 = 150;
  const beltX1 = 930;

  // Produk di ban berjalan: bergerak per "ketukan" mesin (tiap 0.4 dtk lompat 60px)
  const beltBoxes = Array.from({ length: 8 }, (_, i) => {
    const beat = Math.floor((t - 1.0) / 0.4) - i * 2;
    if (beat < 0) return null;
    const x = beltX0 + 40 + beat * 60;
    if (x > beltX1 - 40) return null;
    return x;
  });

  // Fase B: grid produk (mulai 5.6), terisi baris demi baris
  const gridStart = 5.7;
  // Fase C: pecah jadi titik (10.7 – 12)
  const shatter = progress(frame, 10.7, ERA, 0.7);
  const toDot = progress(frame, 11.2, ERA, 0.6);

  // Smoke: kotak kecil naik patah-patah dari cerobong
  const smoke = Array.from({ length: 6 }, (_, i) => {
    const life = ((t + i * 0.5) % 3) / 3;
    return { life, x: i % 2 === 0 ? 0 : 1 };
  });

  const factoryW = 520;
  const factoryX = 540 - factoryW / 2;
  const factoryTop = 810;

  return (
    <AbsoluteFill>
      <BigNumber value={CONTENT.m1.number} color={accent} era={ERA} exitAt={DUR - 0.5} />

      <SceneTransition era={ERA} duration={DUR} enter={0} exit={0}>
        <BackgroundGrid opacity={progress(frame, 0, ERA, 1) * (1 - progress(frame, 11.0, ERA, 0.8))} />
        <KeyText lines={CONTENT.m1.lines} era={ERA} accent={accent} />

        {/* Pabrik */}
        <div
          style={{
            position: "absolute",
            left: factoryX,
            top: factoryTop,
            width: factoryW,
            clipPath: `inset(${(1 - factoryIn) * 100}% 0 0 0)`,
            opacity: 1 - factoryOut,
            transform: `translateY(${-factoryOut * 60}px)`,
          }}
        >
          {smoke.map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (s.x === 0 ? 380 : 440) * (factoryW / 560) + 6,
                top: -s.life * 90,
                width: 14 - s.life * 6,
                height: 14 - s.life * 6,
                background: COLORS.textMuted,
                opacity: (1 - s.life) * 0.6 * (t > 0.8 ? 1 : 0),
              }}
            />
          ))}
          <FactoryIcon size={factoryW} color="rgba(255,255,255,0.88)" />
        </div>

        {/* Ban berjalan */}
        <svg
          width={1080}
          height={1920}
          style={{ position: "absolute", opacity: (1 - factoryOut) * progress(frame, 0.6, ERA, 0.5) }}
        >
          <g stroke="rgba(255,255,255,0.75)" strokeWidth={4} fill="none">
            <rect x={beltX0} y={beltY} width={beltX1 - beltX0} height={36} rx={18} />
          </g>
          {Array.from({ length: 13 }, (_, i) => {
            const cx = beltX0 + 18 + i * ((beltX1 - beltX0 - 36) / 12);
            const a = (Math.floor(sf / 4) * 30) % 360;
            return (
              <g key={i} transform={`translate(${cx} ${beltY + 18}) rotate(${a})`}>
                <circle r={10} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={3} />
                <line x1={-10} y1={0} x2={10} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={3} />
              </g>
            );
          })}
          <line x1={beltX0 + 30} y1={beltY + 36} x2={beltX0 + 30} y2={beltY + 110} stroke="rgba(255,255,255,0.4)" strokeWidth={4} />
          <line x1={beltX1 - 30} y1={beltY + 36} x2={beltX1 - 30} y2={beltY + 110} stroke="rgba(255,255,255,0.4)" strokeWidth={4} />
        </svg>
        <div style={{ position: "absolute", inset: 0, opacity: 1 - factoryOut }}>
          {beltBoxes.map((x, i) =>
            x === null ? null : (
              <BoxIcon
                key={i}
                size={70}
                accent={accent}
                style={{ position: "absolute", left: x - 35, top: beltY - 70 }}
              />
            ),
          )}
        </div>
      </SceneTransition>

      {/* Grid produk identik -> pecah jadi titik (di luar SceneTransition: lanjut ke scene 2) */}
      {GRID_POSITIONS.map((p, i) => {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const appear = progress(frame, gridStart + row * 0.55 + col * 0.12, ERA, 0.25);
        if (appear <= 0) return null;
        const fragments = [0, 1, 2, 3].map((k) => {
          const ang = (k * Math.PI) / 2 + Math.PI / 4 + seeded(i * 4 + k) * 0.4;
          const dist = shatter * (40 + seeded(i + k * 7) * 30);
          return {
            dx: Math.cos(ang) * dist,
            dy: Math.sin(ang) * dist,
            o: shatter > 0 ? (1 - toDot) * (1 - shatter * 0.4) : 0,
          };
        });
        const boxScale = 1 - shatter;
        const dotSize = mix(0, 22, toDot);
        return (
          <React.Fragment key={i}>
            {boxScale > 0.01 && (
              <BoxIcon
                size={BOX}
                accent={accent}
                style={{
                  position: "absolute",
                  left: p.x - BOX / 2,
                  top: p.y - BOX / 2 + mix(-30, 0, appear),
                  opacity: appear,
                  transform: `scale(${boxScale})`,
                }}
              />
            )}
            {fragments.map((f, k) => (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: p.x + f.dx - 6,
                  top: p.y + f.dy - 6,
                  width: 12,
                  height: 12,
                  background: k === 0 ? accent : COLORS.text,
                  opacity: f.o,
                }}
              />
            ))}
            {dotSize > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: p.x - dotSize / 2,
                  top: p.y - dotSize / 2,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: COLORS.text,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
