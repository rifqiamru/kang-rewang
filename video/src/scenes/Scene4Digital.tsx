import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BigNumber } from "../components/BigNumber";
import { PhoneIcon, StoreIcon } from "../components/Icons";
import { KeyText } from "../components/KeyText";
import { SceneTransition } from "../components/SceneTransition";
import { CONTENT } from "../content";
import { CONVERGE_POINT, PATH_NODES, PHONE_POS, STORE_POS } from "../lib/layout";
import { mix, progress, toSec } from "../lib/motion";
import { COLORS, ERA_ACCENT, FONT, SCENES } from "../theme";
import { NetworkLayer } from "./Scene3Values";

const ERA = 4 as const;
const DUR = SCENES.m4.duration;
const NODE_R = 26;

/**
 * SCENE 4 – MARKETING 4.0: DIGITAL + HUMAN (41–53 dtk)
 * Smartphone <-> toko fisik terhubung, lalu jalur 5A muncul berurutan.
 * Transisi: lima node menyusut jadi satu titik.
 */
export const Scene4Digital: React.FC = () => {
  const frame = useCurrentFrame();
  const t = toSec(frame);
  const accent = ERA_ACCENT[4];
  const times = CONTENT.m4.pathTimes;

  const netFade = mix(1, 0.16, progress(frame, 0.1, ERA, 0.5));
  const phoneIn = progress(frame, 0.15, ERA);
  const storeIn = progress(frame, 0.27, ERA);
  const linkIn = progress(frame, 0.45, ERA, 0.35);
  const topOut = progress(frame, 10.0, ERA, 0.3);
  const converge = progress(frame, 10.35, ERA, 0.55);
  const finalDot = progress(frame, 10.7, ERA, 0.3);

  const lx0 = PHONE_POS.x + 85;
  const lx1 = STORE_POS.x - 120;
  const ly = PHONE_POS.y;

  // index node aktif terakhir
  const active = times.reduce((acc, at, i) => (t >= at ? i : acc), -1);

  const nodePos = (i: number) => ({
    x: mix(PATH_NODES[i].x, CONVERGE_POINT.x, converge),
    y: mix(PATH_NODES[i].y, CONVERGE_POINT.y, converge),
  });

  return (
    <AbsoluteFill>
      <BigNumber value={CONTENT.m4.number} color={accent} era={ERA} enterAt={0.0} exitAt={DUR - 1.4} />

      {/* Jaringan dari scene 3 meredup jadi latar */}
      <NetworkLayer edges={1} nodes={1} color={accent} opacity={netFade * (1 - topOut)} />

      <SceneTransition era={ERA} duration={DUR} enter={0} exit={0.25}>
        <KeyText lines={CONTENT.m4.lines} era={ERA} accent={accent} />
      </SceneTransition>

      {/* Online <-> offline */}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - topOut }}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          <line
            x1={lx0}
            y1={ly}
            x2={mix(lx0, lx1, linkIn)}
            y2={ly}
            stroke={COLORS.line}
            strokeWidth={3}
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          {linkIn >= 1 &&
            [0, 1, 2].map((k) => {
              const cycle = ((t * 1.1 + k / 3) % 1 + 1) % 1;
              const dir = k % 2 === 0 ? cycle : 1 - cycle;
              return (
                <circle key={k} cx={mix(lx0, lx1, dir)} cy={ly} r={7} fill={k === 1 ? COLORS.text : accent} />
              );
            })}
        </svg>
        <PhoneIcon
          size={120}
          accent={accent}
          style={{
            position: "absolute",
            left: PHONE_POS.x - 60,
            top: PHONE_POS.y - 102,
            opacity: phoneIn,
            transform: `translateX(${mix(-60, 0, phoneIn)}px)`,
          }}
        />
        <StoreIcon
          size={200}
          accent={accent}
          style={{
            position: "absolute",
            left: STORE_POS.x - 100,
            top: STORE_POS.y - 95,
            opacity: storeIn,
            transform: `translateX(${mix(60, 0, storeIn)}px)`,
          }}
        />
      </div>

      {/* Jalur 5A */}
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {PATH_NODES.slice(1).map((_, i) => {
          const seg = progress(frame, times[i + 1] - 0.18, ERA, 0.18);
          const a = nodePos(i);
          const b = nodePos(i + 1);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={mix(a.x, b.x, seg)}
              y2={mix(a.y, b.y, seg)}
              stroke={accent}
              strokeWidth={4}
              opacity={seg > 0 ? 1 - converge : 0}
            />
          );
        })}
        {PATH_NODES.map((_, i) => {
          const pop = progress(frame, times[i], ERA, 0.25);
          if (pop <= 0) return null;
          const ripple = progress(frame, times[i], 3, 0.8);
          const p = nodePos(i);
          const isActive = i === active;
          const r = NODE_R * mix(1.5, 1, pop) * mix(1, 0.55, converge);
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R + ripple * 40}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                opacity={(1 - ripple) * 0.8}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={isActive || converge > 0 ? accent : COLORS.bg}
                stroke={accent}
                strokeWidth={4}
                opacity={1 - finalDot * (i === 2 ? 0 : 1)}
              />
            </g>
          );
        })}
      </svg>

      {/* Label hanya untuk node aktif (jaga maks. 7 kata per layar) */}
      {active >= 0 && (
        <div
          key={active}
          style={{
            position: "absolute",
            left: PATH_NODES[active].x - 160,
            top: PATH_NODES[active].y + 46,
            width: 320,
            textAlign: "center",
            fontFamily: FONT.family,
            fontWeight: FONT.weight.semibold,
            fontSize: FONT.size.label + 4,
            color: COLORS.text,
            opacity: progress(frame, times[active], ERA, 0.2) * (1 - topOut),
            transform: `translateY(${mix(14, 0, progress(frame, times[active], ERA, 0.2))}px)`,
          }}
        >
          {CONTENT.m4.path[active]}
        </div>
      )}
    </AbsoluteFill>
  );
};
