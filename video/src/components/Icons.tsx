import React from "react";
import { COLORS } from "../theme";

// Ikon sederhana, murni SVG. Semua menerima `size` (lebar px) dan `color`.

type IconProps = { size: number; color?: string; stroke?: number; style?: React.CSSProperties };

export const PersonIcon: React.FC<IconProps & { body?: number }> = ({ size, color = COLORS.text, body = 1, style }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 40 52" style={{ overflow: "visible", ...style }}>
    <circle cx={20} cy={12} r={9} fill={color} />
    <path
      d="M3 50 C3 35 11 28 20 28 C29 28 37 35 37 50 Z"
      fill={color}
      style={{ transform: `scale(${body})`, transformOrigin: "20px 28px" }}
    />
  </svg>
);

export const BoxIcon: React.FC<IconProps & { accent: string }> = ({ size, color = COLORS.text, accent, style }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" style={style}>
    <rect x={8} y={14} width={64} height={58} rx={4} fill="none" stroke={color} strokeWidth={4} />
    <path d="M8 30 H72" stroke={color} strokeWidth={4} />
    <rect x={32} y={14} width={16} height={16} fill={accent} />
    <rect x={18} y={52} width={22} height={8} fill={color} opacity={0.5} />
  </svg>
);

export const FactoryIcon: React.FC<IconProps> = ({ size, color = COLORS.text, style }) => (
  <svg width={size} height={(size * 260) / 560} viewBox="0 0 560 260" style={style}>
    <path
      d="M0 260 V140 L90 90 V140 L180 90 V140 L270 90 V140 L360 90 V40 H400 V140 H420 V20 H460 V140 H560 V260 Z"
      fill={color}
    />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={30 + i * 90} y={170} width={44} height={36} fill={COLORS.bg} />
    ))}
    <rect x={430} y={180} width={80} height={80} fill={COLORS.bg} />
  </svg>
);

export const HEART_PATH =
  "M50 88 C22 68 3 50 3 29 C3 13 15 3 29 3 C39 3 46 9 50 17 C54 9 61 3 71 3 C85 3 97 13 97 29 C97 50 78 68 50 88 Z";

export const HeartIcon: React.FC<IconProps & { fill?: string; draw?: number }> = ({
  size,
  color = COLORS.text,
  fill = "none",
  stroke = 4,
  draw = 1,
  style,
}) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 100 90" style={{ overflow: "visible", ...style }}>
    <path
      d={HEART_PATH}
      fill={fill}
      stroke={color}
      strokeWidth={stroke}
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - draw}
    />
  </svg>
);

export const GlobeIcon: React.FC<IconProps> = ({ size, color = COLORS.text, stroke = 4, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <g fill="none" stroke={color} strokeWidth={stroke}>
      <circle cx={50} cy={50} r={44} />
      <ellipse cx={50} cy={50} rx={20} ry={44} />
      <path d="M6 50 H94 M14 28 H86 M14 72 H86" />
    </g>
  </svg>
);

export const HandsIcon: React.FC<IconProps & { accent: string }> = ({ size, color = COLORS.text, accent, stroke = 4, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    {/* tunas kecil yang "dijaga" */}
    <path d="M50 54 V32" stroke={accent} strokeWidth={stroke} strokeLinecap="round" />
    <path d="M50 40 C40 40 34 32 34 24 C44 24 50 30 50 40 Z" fill={accent} />
    <path d="M50 36 C58 36 64 30 64 22 C56 22 50 28 50 36 Z" fill={accent} />
    {/* dua tangan menangkup */}
    <g fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 52 C10 72 26 86 50 86 C74 86 90 72 92 52" />
      <path d="M8 52 C8 46 16 44 20 50 L30 64" />
      <path d="M92 52 C92 46 84 44 80 50 L70 64" />
      <path d="M30 64 C38 70 62 70 70 64" />
    </g>
  </svg>
);

export const CommunityIcon: React.FC<IconProps> = ({ size, color = COLORS.text, style }) => (
  <svg width={size} height={size * 0.75} viewBox="0 0 120 90" style={style}>
    <g fill={color}>
      <circle cx={24} cy={36} r={10} opacity={0.65} />
      <path d="M6 86 C6 68 14 54 24 54 C34 54 42 68 42 86 Z" opacity={0.65} />
      <circle cx={96} cy={36} r={10} opacity={0.65} />
      <path d="M78 86 C78 68 86 54 96 54 C106 54 114 68 114 86 Z" opacity={0.65} />
      <circle cx={60} cy={22} r={14} />
      <path d="M34 90 C34 64 46 46 60 46 C74 46 86 64 86 90 Z" />
    </g>
  </svg>
);

export const PhoneIcon: React.FC<IconProps & { accent: string; t?: number }> = ({
  size,
  color = COLORS.text,
  accent,
  stroke = 5,
  style,
}) => (
  <svg width={size} height={size * 1.7} viewBox="0 0 100 170" style={style}>
    <rect x={6} y={4} width={88} height={162} rx={16} fill="none" stroke={color} strokeWidth={stroke} />
    <rect x={38} y={14} width={24} height={6} rx={3} fill={color} />
    <rect x={20} y={38} width={44} height={16} rx={8} fill={color} opacity={0.35} />
    <rect x={36} y={64} width={46} height={16} rx={8} fill={accent} />
    <rect x={20} y={90} width={36} height={16} rx={8} fill={color} opacity={0.35} />
    <rect x={44} y={116} width={38} height={16} rx={8} fill={accent} opacity={0.7} />
  </svg>
);

export const StoreIcon: React.FC<IconProps & { accent: string }> = ({ size, color = COLORS.text, accent, stroke = 5, style }) => (
  <svg width={size} height={size * 0.95} viewBox="0 0 180 170" style={style}>
    <g fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round">
      <path d="M16 70 V164 H164 V70" />
      <path d="M8 24 H172 L164 6 H16 Z" />
    </g>
    {/* kanopi bergaris */}
    {[0, 1, 2, 3, 4].map((i) => (
      <path
        key={i}
        d={`M${8 + i * 32.8} 24 h32.8 v26 a16.4 16.4 0 0 1 -32.8 0 Z`}
        fill={i % 2 === 0 ? accent : "none"}
        stroke={color}
        strokeWidth={stroke}
      />
    ))}
    <rect x={30} y={96} width={52} height={68} fill="none" stroke={color} strokeWidth={stroke} />
    <rect x={102} y={96} width={46} height={36} fill={color} opacity={0.3} />
  </svg>
);

export const ChatIcon: React.FC<IconProps> = ({ size, color = COLORS.text, stroke = 6, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path
      d="M50 8 C26 8 8 25 8 46 C8 56 12 65 19 72 L14 92 L35 83 C40 84 45 85 50 85 C74 85 92 68 92 46 C92 25 74 8 50 8 Z"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinejoin="round"
    />
    <circle cx={32} cy={47} r={6} fill={color} />
    <circle cx={50} cy={47} r={6} fill={color} />
    <circle cx={68} cy={47} r={6} fill={color} />
  </svg>
);
