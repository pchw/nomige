import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { Enter as EnterKind } from "../timeline";

/** トランジションにかけるフレーム数。前のカットはこの間だけ下に残る */
export const ENTER_LEN = 5;

/** カットの入り方。下に前のカットが残っているので、上から被せて切り替える */
export function Enter({ kind, children }: { kind: EnterKind; children: ReactNode }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, ENTER_LEN], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  let style: CSSProperties = {};
  switch (kind) {
    case "whip":
      style = {
        transform: `translateX(${(1 - t) * 100}%)`,
        filter: t < 1 ? `blur(${(1 - t) * 24}px)` : undefined,
      };
      break;
    case "iris":
      style = { clipPath: `circle(${t * 120}% at 50% 50%)` };
      break;
    case "slide-up":
      style = { transform: `translateY(${(1 - t) * 100}%)` };
      break;
    case "zoom":
      style = { transform: `scale(${1.6 - 0.6 * t})`, opacity: Math.min(1, t * 2) };
      break;
    case "cut":
      break;
  }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
}
