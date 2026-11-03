import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BigNumber } from "../components/BigNumber";
import { CommunityIcon, GlobeIcon, HandsIcon, HeartIcon } from "../components/Icons";
import { KeyText } from "../components/KeyText";
import { SceneTransition } from "../components/SceneTransition";
import { CONTENT } from "../content";
import { HEART_CENTER, HEART_START, NETWORK_EDGES, NETWORK_NODES, VALUE_NODES } from "../lib/layout";
import { mix, progress } from "../lib/motion";
import { COLORS, ERA_ACCENT, SCENES } from "../theme";
import { HEART_SIZE_START } from "./Scene2Customer";

const ERA = 3 as const;
const DUR = SCENES.m3.duration;
const HEART_SIZE = 250;
const NODE_R = 92;

/** Jaringan digital (dipakai juga di awal scene 4 supaya transisi nyambung). */
export const NetworkLayer: React.FC<{ edges: number; nodes: number; color: string; opacity?: number }> = ({
  edges,
  nodes,
  color,
  opacity = 1,
}) => (
  <svg width={1080} height={1920} style={{ position: "absolute", opacity }}>
    <g stroke={COLORS.line} strokeWidth={2}>
      {NETWORK_EDGES.map(([a, b], i) => {
        const p = Math.min(1, Math.max(0, edges * 1.6 - (i / NETWORK_EDGES.length) * 0.6));
        const A = NETWORK_NODES[a];
        const B = NETWORK_NODES[b];
        return <line key={i} x1={A.x} y1={A.y} x2={mix(A.x, B.x, p)} y2={mix(A.y, B.y, p)} opacity={p > 0 ? 1 : 0} />;
      })}
    </g>
    {NETWORK_NODES.map((n, i) => {
      const p = Math.min(1, Math.max(0, nodes * 1.5 - (i / NETWORK_NODES.length) * 0.5));
      return <circle key={i} cx={n.x} cy={n.y} r={(i < 4 ? 11 : 7) * p} fill={i < 4 ? color : COLORS.text} />;
    })}
  </svg>
);

/**
 * SCENE 3 – MARKETING 3.0: VALUES-DRIVEN (29–41 dtk)
 * Hati membesar, terhubung ke bumi, tangan, komunitas lewat garis organik.
 * Transisi: garis meluruskan diri dan menjadi jaringan digital.
 */
export const Scene3Values: React.FC = () => {
  const frame = useCurrentFrame();
  const accent = ERA_ACCENT[3];

  const move = progress(frame, 0, ERA, 1.6);
  const beat = 1 + 0.035 * Math.pow(Math.max(0, Math.sin(frame / 9)), 6);
  const toNet = progress(frame, 10.0, ERA, 1.4); // garis organik -> jaringan
  const netIn = progress(frame, 10.4, ERA, 1.4);

  const hx = mix(HEART_START.x, HEART_CENTER.x, move);
  const hy = mix(HEART_START.y, HEART_CENTER.y, move);
  const hs = mix(HEART_SIZE_START, HEART_SIZE, move) * mix(1, 0.06, toNet);

  const icons = [
    <GlobeIcon key="g" size={110} color={COLORS.text} />,
    <HandsIcon key="h" size={124} color={COLORS.text} accent={accent} />,
    <CommunityIcon key="c" size={124} color={COLORS.text} />,
  ];

  return (
    <AbsoluteFill>
      <BigNumber value={CONTENT.m3.number} color={accent} era={ERA} enterAt={0.1} exitAt={DUR - 0.7} />

      <SceneTransition era={ERA} duration={DUR} enter={0} exit={0.5}>
        <KeyText lines={CONTENT.m3.lines} era={ERA} accent={accent} />
      </SceneTransition>

      {/* Cahaya hangat lembut di belakang hati */}
      <div
        style={{
          position: "absolute",
          left: hx - 380,
          top: hy - 380,
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}30 0%, ${accent}00 65%)`,
          opacity: move * (1 - toNet),
          transform: `scale(${beat})`,
        }}
      />

      {/* Jaringan digital muncul di akhir scene */}
      <NetworkLayer edges={netIn} nodes={netIn} color={ERA_ACCENT[4]} />

      {/* Garis organik hati -> nilai */}
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {VALUE_NODES.map((n, i) => {
          const draw = progress(frame, 1.8 + i * 0.75, ERA, 1.3);
          const dx = n.x - hx;
          const dy = n.y - hy;
          const len = Math.hypot(dx, dy);
          const wave = (60 + 25 * Math.sin(frame / 22 + i * 2)) * (1 - toNet) * (i % 2 === 0 ? 1 : -1);
          const cx = (hx + n.x) / 2 + (-dy / len) * wave;
          const cy = (hy + n.y) / 2 + (dx / len) * wave;
          return (
            <path
              key={i}
              d={`M${hx} ${hy} Q${cx} ${cy} ${n.x} ${n.y}`}
              fill="none"
              stroke={toNet > 0.5 ? COLORS.line : accent}
              strokeOpacity={mix(0.75, 1, toNet)}
              strokeWidth={mix(3, 2, toNet)}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - draw}
            />
          );
        })}
      </svg>

      {/* Node nilai: bumi, tangan, komunitas */}
      {VALUE_NODES.map((n, i) => {
        const appear = progress(frame, 2.6 + i * 0.75, ERA, 1.1);
        const float = Math.sin(frame / 26 + i * 1.7) * 8 * (1 - toNet);
        const shrink = mix(1, 0.12, toNet);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: n.x - NODE_R,
              top: n.y - NODE_R + float,
              width: NODE_R * 2,
              height: NODE_R * 2,
              borderRadius: "50%",
              background: toNet > 0.6 ? ERA_ACCENT[4] : COLORS.bg,
              border: `2px solid ${accent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: appear,
              filter: `blur(${(1 - appear) * 12}px)`,
              transform: `scale(${mix(0.7, 1, appear) * shrink})`,
            }}
          >
            <div style={{ opacity: 1 - toNet * 1.6 }}>{icons[i]}</div>
          </div>
        );
      })}

      {/* Hati */}
      <HeartIcon
        size={HEART_SIZE}
        color={accent}
        fill={accent}
        style={{
          position: "absolute",
          left: hx - HEART_SIZE / 2,
          top: hy - (HEART_SIZE * 0.9) / 2,
          transform: `scale(${(hs / HEART_SIZE) * beat})`,
          opacity: 1 - progress(frame, 11.0, ERA, 0.6),
        }}
      />
    </AbsoluteFill>
  );
};
