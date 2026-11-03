import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChatIcon } from "../components/Icons";
import { KeyText } from "../components/KeyText";
import { BRAND_NAME, WHATSAPP_NUMBER } from "../config";
import { CONTENT } from "../content";
import { CONVERGE_POINT } from "../lib/layout";
import { mix, progress } from "../lib/motion";
import { COLORS, Era, ERA_ACCENT, FONT } from "../theme";

const ROW_GAP = 200;
const SPINE_X = CONVERGE_POINT.x;
const ROW_Y = (i: number) => CONVERGE_POINT.y + (i - 1.5) * ROW_GAP;

/**
 * SCENE 5 – RECAP + CTA (53–60 dtk)
 * Titik dari scene 4 memanjang jadi garis; empat versi terisi satu per satu.
 * Lalu pertanyaan, logo QREATIVA, dan nomor WhatsApp.
 */
export const Scene5Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { recap, recapTimes, question, ctaLabel } = CONTENT.cta;

  const spine = progress(frame, 0.0, 2, 0.4);
  const listOut = progress(frame, 2.7, 4, 0.3);
  const qIn = 2.9;
  const qOut = progress(frame, 4.75, 3, 0.35);
  const logoIn = progress(frame, 4.95, 3, 0.8);
  const bar = progress(frame, 5.3, 4, 0.4);
  const ctaIn = progress(frame, 5.55, 2, 0.35);

  const spineTop = ROW_Y(0) - 70;
  const spineBot = ROW_Y(3) + 70;

  return (
    <AbsoluteFill>
      {/* Recap */}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - listOut, transform: `translateY(${-listOut * 40}px)` }}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          <line
            x1={SPINE_X}
            y1={mix(CONVERGE_POINT.y, spineTop, spine)}
            x2={SPINE_X}
            y2={mix(CONVERGE_POINT.y, spineBot, spine)}
            stroke={COLORS.line}
            strokeWidth={3}
          />
          {spine < 1 && <circle cx={SPINE_X} cy={CONVERGE_POINT.y} r={14} fill={ERA_ACCENT[4]} />}
          {recap.map((_, i) => {
            const fill = progress(frame, recapTimes[i], 2, 0.3);
            return (
              <circle
                key={i}
                cx={SPINE_X}
                cy={ROW_Y(i)}
                r={mix(6, 12, fill)}
                fill={fill > 0 ? ERA_ACCENT[(i + 1) as Era] : COLORS.bg}
                stroke={fill > 0 ? ERA_ACCENT[(i + 1) as Era] : COLORS.line}
                strokeWidth={3}
                opacity={progress(frame, 0.15 + i * 0.06, 4, 0.2)}
              />
            );
          })}
        </svg>
        {recap.map((r, i) => {
          const era = (i + 1) as Era;
          const outline = progress(frame, 0.15 + i * 0.06, 4, 0.25);
          const fill = progress(frame, recapTimes[i], 2, 0.35);
          const numberStyle: React.CSSProperties = {
            position: "absolute",
            right: 1080 - (SPINE_X - 50),
            top: ROW_Y(i) - 80,
            height: 160,
            lineHeight: "160px",
            fontFamily: FONT.family,
            fontWeight: FONT.weight.black,
            fontSize: 150,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
          };
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  ...numberStyle,
                  color: "transparent",
                  WebkitTextStroke: "2px rgba(255,255,255,0.35)",
                  opacity: outline,
                }}
              >
                {r.number}
              </div>
              <div
                style={{
                  ...numberStyle,
                  color: ERA_ACCENT[era],
                  clipPath: `inset(${(1 - fill) * 100}% 0 0 0)`,
                }}
              >
                {r.number}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: SPINE_X + 50,
                  top: ROW_Y(i) - 40,
                  height: 80,
                  lineHeight: "80px",
                  fontFamily: FONT.family,
                  fontWeight: FONT.weight.regular,
                  fontSize: 62,
                  color: COLORS.text,
                  opacity: fill,
                  transform: `translateX(${mix(-24, 0, fill)}px)`,
                }}
              >
                {r.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Pertanyaan */}
      <div style={{ opacity: 1 - qOut }}>
        <KeyText
          lines={[
            { text: question.join(" "), from: qIn, to: 99, kind: "title" },
          ]}
          era={4}
          accent={ERA_ACCENT[4]}
          top={760}
          height={300}
          fontScale={1.25}
        />
      </div>

      {/* Logo + CTA */}
      <div
        style={{
          position: "absolute",
          top: 700,
          left: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: FONT.family,
        }}
      >
        <div
          style={{
            fontWeight: FONT.weight.black,
            fontSize: 124,
            letterSpacing: "0.06em",
            color: COLORS.text,
            opacity: logoIn,
            filter: `blur(${(1 - logoIn) * 14}px)`,
            transform: `scale(${mix(1.08, 1, logoIn)})`,
            marginRight: "-0.06em",
          }}
        >
          {BRAND_NAME}
        </div>
        <div
          style={{
            marginTop: 18,
            width: 560 * bar,
            height: 8,
            borderRadius: 4,
            background: COLORS.accent,
          }}
        />
        <div
          style={{
            marginTop: 90,
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "26px 44px",
            borderRadius: 999,
            border: `3px solid ${COLORS.accent}`,
            opacity: ctaIn,
            transform: `translateY(${mix(40, 0, ctaIn)}px)`,
          }}
        >
          <ChatIcon size={72} color={COLORS.accent} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 32, fontWeight: FONT.weight.medium, color: COLORS.textMuted }}>{ctaLabel}</span>
            <span style={{ fontSize: 58, fontWeight: FONT.weight.bold, color: COLORS.text, letterSpacing: "0.01em" }}>
              {WHATSAPP_NUMBER}
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
