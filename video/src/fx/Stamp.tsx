import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { C, LINE, shadow } from "../theme";
import { pop } from "./motion";

/** 回転しながら叩きつけられるスタンプ文字（アプリのボタンと同じ太線＋ずらした影） */
export function Stamp({
  children,
  at = 0,
  bg = C.white,
  color = C.ink,
  size = 150,
  rotate = -6,
  style,
}: {
  children: ReactNode;
  at?: number;
  bg?: string;
  color?: string;
  size?: number;
  rotate?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, 9);
  const scale = 2.4 - 1.4 * p;
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * 0.12}px ${size * 0.32}px`,
        background: bg,
        color,
        border: LINE,
        borderRadius: 24,
        boxShadow: shadow(16),
        fontFamily: "var(--font-display)",
        fontSize: size,
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        transform: `rotate(${rotate + (1 - p) * 18}deg) scale(${scale})`,
        opacity: Math.min(1, p * 3),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 縁取り＋ずらした影の大文字（ロゴやテロップ用） */
export function BigText({
  children,
  size = 180,
  color = C.white,
  shadowColor = C.ink,
  stroke = 10,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  shadowColor?: string;
  stroke?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        lineHeight: 1.05,
        color,
        WebkitTextStroke: `${stroke}px ${C.ink}`,
        paintOrder: "stroke fill",
        textShadow: `${size * 0.06}px ${size * 0.06}px 0 ${shadowColor}`,
        whiteSpace: "nowrap",
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
