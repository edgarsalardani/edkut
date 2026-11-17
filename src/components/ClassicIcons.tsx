// Símbolos do Orkut clássico em SVG (sem imagens externas): carinha, cubinho, coração e estrela.
// "filled" = preenchido (colorido); vazio = cinza claro.
import type { ClassicIconKind } from "@/lib/profileClassic";

export type IconKind = ClassicIconKind | "star";

const EMPTY_FILL = "#E6EDF6";
const EMPTY_STROKE = "#B9C8DA";

export function ClassicIcon({ kind, filled, size = 18 }: { kind: IconKind; filled: boolean; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 20 20", "aria-hidden": true, focusable: false } as const;
  if (kind === "smile") {
    return (
      <svg {...common} data-icon="smile" data-filled={filled}>
        <circle cx="10" cy="10" r="8.5" fill={filled ? "#F7C531" : EMPTY_FILL} stroke={filled ? "#D9971A" : EMPTY_STROKE} strokeWidth="1.2" />
        <circle cx="7" cy="8" r="1.2" fill={filled ? "#6B4410" : EMPTY_STROKE} />
        <circle cx="13" cy="8" r="1.2" fill={filled ? "#6B4410" : EMPTY_STROKE} />
        <path d="M5.5 11.5c1 2.6 3 3.6 4.5 3.6s3.5-1 4.5-3.6" fill="none" stroke={filled ? "#6B4410" : EMPTY_STROKE} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "cube") {
    const [top, left, right, line] = filled ? ["#A9D3F7", "#4A90D9", "#2C67AA", "#1D4E89"] : ["#F3F7FB", EMPTY_FILL, "#D3DFEC", EMPTY_STROKE];
    return (
      <svg {...common} data-icon="cube" data-filled={filled}>
        <polygon points="10,2 18,6 10,10 2,6" fill={top} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
        <polygon points="2,6 10,10 10,18 2,14" fill={left} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
        <polygon points="18,6 18,14 10,18 10,10" fill={right} stroke={line} strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "heart") {
    return (
      <svg {...common} data-icon="heart" data-filled={filled}>
        <path
          d="M10 17.6C2.2 11.8 1.8 6 5.6 4.2c2-.9 3.7.1 4.4 1.6.7-1.5 2.4-2.5 4.4-1.6 3.8 1.8 3.4 7.6-4.4 13.4z"
          fill={filled ? "#E0457B" : EMPTY_FILL}
          stroke={filled ? "#A9146A" : EMPTY_STROKE}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common} data-icon="star" data-filled={filled}>
      <polygon
        points="10,1.6 12.6,7.2 18.7,7.9 14.2,12 15.4,18 10,15 4.6,18 5.8,12 1.3,7.9 7.4,7.2"
        fill={filled ? "#F5B316" : EMPTY_FILL}
        stroke={filled ? "#C98A1B" : EMPTY_STROKE}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
