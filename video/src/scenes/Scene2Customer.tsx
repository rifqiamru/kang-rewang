import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BigNumber } from "../components/BigNumber";
import { HeartIcon, PersonIcon } from "../components/Icons";
import { KeyText } from "../components/KeyText";
import { SceneTransition } from "../components/SceneTransition";
import { CONTENT } from "../content";
import {
  CLUSTER_POSITIONS,
  CROSSHAIR_RADIUS,
  CROWD_GROUP,
  CROWD_POSITIONS,
  GRID_POSITIONS,
  HEART_START,
} from "../lib/layout";
import { mix, progress } from "../lib/motion";
import { COLORS, ERA_ACCENT, SCENES } from "../theme";

const ERA = 2 as const;
const DUR = SCENES.m2.duration;
const PERSON = 52;
/** Jarak pusat kepala ke kiri-atas ikon orang. */
const HEAD_OFFSET = { x: PERSON / 2, y: (12 / 52) * PERSON * 1.3 };

export const HEART_SIZE_START = 180;

/**
 * SCENE 2 – MARKETING 2.0: CUSTOMER-CENTRIC (17–29 dtk)
 * Titik -> orang -> terpisah ke kelompok warna (segmentasi) -> crosshair
 * mengunci satu kelompok (targeting) -> crosshair berubah jadi hati.
 */
export const Scene2Customer: React.FC = () => {
  const frame = useCurrentFrame();
  const accent = ERA_ACCENT[2];
  const groupColor = [accent, COLORS.text, "rgba(255,255,255,0.38)"];

  const morph = progress(frame, 0.0, ERA, 0.7); // titik -> posisi kerumunan
  const body = progress(frame, 0.45, ERA, 0.4); // titik tumbuh jadi orang
  const lock = progress(frame, 4.4, ERA, 0.35); // crosshair snap
  const dim = progress(frame, 7.0, ERA, 0.3); // kelompok lain meredup
  const toHeart = progress(frame, 10.4, 3, 0.9); // crosshair -> hati
  const peopleOut = progress(frame, 10.3, ERA, 0.5);

  const ch = HEART_START;
  const r = CROSSHAIR_RADIUS * mix(1.7, 1, lock) * mix(1, 0.45, toHeart);
  const tick = 46 * (1 - toHeart);
  const pulse = 1 + 0.03 * Math.max(0, Math.sin((frame - 150) / 4)) * (dim > 0 ? 1 : 0) * (1 - toHeart);

  return (
    <AbsoluteFill>
      <BigNumber value={CONTENT.m2.number} color={accent} era={ERA} enterAt={0.05} exitAt={DUR - 0.35} />

      <SceneTransition era={ERA} duration={DUR} enter={0} exit={0.3}>
        <KeyText lines={CONTENT.m2.lines} era={ERA} accent={accent} />
      </SceneTransition>

      {/* Orang */}
      {GRID_POSITIONS.map((g, i) => {
        const group = CROWD_GROUP[i];
        const seg = progress(frame, 2.6 + group * 0.14 + (i % 4) * 0.03, ERA, 0.3);
        const crowd = CROWD_POSITIONS[i];
        const cluster = CLUSTER_POSITIONS[i];
        const x = mix(mix(g.x, crowd.x, morph), cluster.x, seg);
        const y = mix(mix(g.y, crowd.y, morph), cluster.y, seg);
        const color = seg > 0.5 ? groupColor[group] : COLORS.text;
        const isTarget = group === 0;
        let opacity = isTarget ? 1 : mix(1, 0.22, dim);
        opacity *= isTarget ? 1 - toHeart : 1 - peopleOut;
        const scale = isTarget ? mix(1, 1.08, dim) * mix(1, 0.4, toHeart) : 1;
        const tx = isTarget ? mix(x, ch.x, toHeart * toHeart) : x;
        const ty = isTarget ? mix(y, ch.y, toHeart * toHeart) : y;
        return (
          <PersonIcon
            key={i}
            size={PERSON}
            color={color}
            body={body}
            style={{
              position: "absolute",
              left: tx - HEAD_OFFSET.x,
              top: ty - HEAD_OFFSET.y,
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: `${HEAD_OFFSET.x}px ${HEAD_OFFSET.y}px`,
            }}
          />
        );
      })}

      {/* Crosshair -> hati */}
      {lock > 0 && (
        <svg
          width={1080}
          height={1920}
          style={{ position: "absolute", opacity: Math.min(1, lock * 2) }}
        >
          <g
            transform={`translate(${ch.x} ${ch.y}) rotate(${mix(45, 0, lock) + toHeart * 90}) scale(${pulse})`}
            stroke={accent}
            strokeWidth={4}
            fill="none"
            opacity={1 - toHeart}
          >
            <circle r={r} />
            <circle r={r * 0.82} strokeOpacity={0.35} strokeDasharray="6 10" />
            <line x1={0} y1={-r - tick * 0.4} x2={0} y2={-r + tick} />
            <line x1={0} y1={r + tick * 0.4} x2={0} y2={r - tick} />
            <line x1={-r - tick * 0.4} y1={0} x2={-r + tick} y2={0} />
            <line x1={r + tick * 0.4} y1={0} x2={r - tick} y2={0} />
          </g>
        </svg>
      )}
      {toHeart > 0 && (
        <HeartIcon
          size={HEART_SIZE_START}
          color={ERA_ACCENT[3]}
          fill={ERA_ACCENT[3]}
          draw={1}
          style={{
            position: "absolute",
            left: ch.x - HEART_SIZE_START / 2,
            top: ch.y - (HEART_SIZE_START * 0.9) / 2,
            opacity: toHeart,
            transform: `scale(${mix(0.3, 1, toHeart)})`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
