import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

/** アプリと同じドット背景。ドットを流して止まって見えないようにする */
export function DotBg({
  color,
  dot = "rgba(17,17,17,0.16)",
  speed = 2,
  children,
  style,
}: {
  color: string;
  dot?: string;
  speed?: number;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const shift = frame * speed;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        backgroundImage: `radial-gradient(${dot} 4px, transparent 4.5px)`,
        backgroundSize: "48px 48px",
        backgroundPosition: `${shift}px ${shift}px`,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/** 中心から放射する集中線 */
export function SpeedLines({
  color = C.ink,
  count = 36,
  opacity = 0.9,
}: {
  color?: string;
  count?: number;
  opacity?: number;
}) {
  const frame = useCurrentFrame();
  const R = 2400;
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg viewBox="-540 -960 1080 1920" width="100%" height="100%">
        <g transform={`rotate(${frame * 3})`}>
          {Array.from({ length: count }, (_, i) => {
            const a = (i / count) * Math.PI * 2;
            const w = ((i * 7) % 5) * 0.006 + 0.012;
            const inner = 380 + ((i * 13) % 7) * 30;
            const p = (ang: number, r: number) => `${Math.cos(ang) * r},${Math.sin(ang) * r}`;
            return (
              <polygon
                key={i}
                points={`${p(a - w, R)} ${p(a + w, R)} ${p(a, inner)}`}
                fill={color}
              />
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
}

/** 白フラッシュ。光過敏に配慮し、使うのは1秒に3回まで・2フレームだけ */
export function Flash({ at, len = 2 }: { at: number; len?: number }) {
  const frame = useCurrentFrame();
  if (frame < at || frame >= at + len) return null;
  return <AbsoluteFill style={{ background: C.white, opacity: 0.85 }} />;
}
