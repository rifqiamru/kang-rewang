import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SHOW_SUBTITLES } from "../config";
import { SUBTITLES } from "../vo";
import { FONT, LAYOUT, sec } from "../theme";

/** Subtitle otomatis dari src/vo.ts, tampil di bawah di dalam safe area. */
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  if (!SHOW_SUBTITLES) return null;
  const cue = SUBTITLES.find((c) => frame >= sec(c.start) && frame < sec(c.end));
  if (!cue) return null;
  const a = sec(cue.start);
  const b = sec(cue.end);
  const opacity = interpolate(frame, [a, a + 3, b - 3, b], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: "100%",
        bottom: LAYOUT.subtitle.bottom,
        display: "flex",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: LAYOUT.subtitle.maxWidth,
          padding: "14px 28px",
          borderRadius: 18,
          background: "rgba(0,0,0,0.62)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: FONT.family,
          fontWeight: FONT.weight.medium,
          fontSize: FONT.size.subtitle,
          lineHeight: 1.3,
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};
