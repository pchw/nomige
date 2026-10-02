import { interpolate, useCurrentFrame } from "remotion";
import { ramp } from "../../fx/motion";
import { C } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Face } from "../parts";

const HIT = 5;

function Body() {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, HIT, (x) => x * x);
  const back = frame >= HIT ? Math.exp(-(frame - HIT) / 3) * 40 : 0;
  const d = interpolate(t, [0, 1], [700, 170]) + back;
  return (
    <>
      {[-1, 1].map((s) => (
        <At key={s} x={540 + s * d} y={880} style={{ transform: `translate(-50%, -50%) rotate(${s * (frame >= HIT ? 12 : -8)}deg)` }}>
          <Face character="cat" size={320} />
        </At>
      ))}
      {frame >= HIT && (
        <At x={540} y={640} style={{ fontSize: 160, lineHeight: 1 }}>
          💥
        </At>
      )}
      <At x={540} y={1150} style={{ fontFamily: "var(--font-display)", fontSize: 60, color: C.ink, whiteSpace: "nowrap" }}>
        ネコ × ネコ
      </At>
    </>
  );
}

export const kabuttaraOut: GameBody = { Body, stamp: "被った!!", stampBg: C.red, shakeAt: HIT };
