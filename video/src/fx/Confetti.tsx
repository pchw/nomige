import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { C } from "../theme";

const COLORS = [C.yellow, C.pink, C.blue, C.green, C.orange, C.purple, C.white];

/** 上から舞う紙吹雪。乱数は seed 固定なので毎フレーム同じ位置に描ける */
export function Confetti({ count = 70, seed = "c" }: { count?: number; seed?: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}${k}${i}`);
        const x = r("x") * 1080 + Math.sin(frame / 5 + i) * 30;
        const y = -100 + (r("y") * 0.6 + 0.4) * frame * 70 - r("d") * 800;
        const w = 22 + r("w") * 26;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: w * 0.5,
              background: COLORS[i % COLORS.length],
              border: `4px solid ${C.ink}`,
              transform: `rotate(${frame * (r("r") * 30 - 15) + r("a") * 360}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}
