import { interpolate, random, useCurrentFrame } from "remotion";
import { ramp } from "../../fx/motion";
import { C } from "../../theme";
import type { GameBody } from "../GameCut";

const HIT = 5;
const PINS = [4, 3, 2, 1].flatMap((n, row) =>
  Array.from({ length: n }, (_, i) => ({ x: 540 + (i - (n - 1) / 2) * 130, y: 560 + row * 110 })),
);

function Pin({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M 0 -80 C 28 -80 30 -40 18 -20 C 44 10 44 60 26 80 L -26 80 C -44 60 -44 10 -18 -20 C -30 -40 -28 -80 0 -80 Z" fill={C.white} stroke={C.ink} strokeWidth={7} />
      <rect x={-17} y={-30} width={34} height={12} fill={C.red} />
    </g>
  );
}

function Body() {
  const frame = useCurrentFrame();
  const by = interpolate(ramp(frame, 0, HIT, (x) => x), [0, 1], [1350, 900]);
  const fly = Math.max(0, frame - HIT);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {PINS.map((p, i) => {
        const dx = (p.x - 540) * 0.08 + (random(`bx${i}`) - 0.5) * 50;
        const dy = -30 - random(`by${i}`) * 30;
        return (
          <Pin key={i} x={p.x + dx * fly} y={p.y + dy * fly + 3 * fly * fly} rot={fly * (random(`br${i}`) * 80 - 40)} />
        );
      })}
      <circle cx={540} cy={by} r={95} fill={C.purple} stroke={C.ink} strokeWidth={9} />
      <circle cx={515} cy={by - 30} r={13} fill={C.ink} />
      <circle cx={560} cy={by - 30} r={13} fill={C.ink} />
      <circle cx={538} cy={by + 5} r={13} fill={C.ink} />
    </svg>
  );
}

export const bowling: GameBody = { Body, stamp: "STRIKE!", stampBg: C.yellow, shakeAt: HIT };
