import { interpolate, useCurrentFrame } from "remotion";
import { pop, ramp } from "../../fx/motion";
import { C } from "../../theme";
import type { GameBody } from "../GameCut";

const IN = 7;
// 奥から 4-3-2-1 の三角形
const CUPS = [4, 3, 2, 1].flatMap((n, row) =>
  Array.from({ length: n }, (_, i) => ({ x: 540 + (i - (n - 1) / 2) * 170, y: 560 + row * 150 })),
);
const TARGET = CUPS[7];

function Cup({ x, y, hit }: { x: number; y: number; hit: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -70 -20 L 70 -20 L 52 120 L -52 120 Z" fill={hit ? C.yellow : C.red} stroke={C.ink} strokeWidth={8} strokeLinejoin="round" />
      <ellipse cx={0} cy={-20} rx={70} ry={22} fill={C.white} stroke={C.ink} strokeWidth={8} />
      <ellipse cx={0} cy={-18} rx={54} ry={14} fill={C.amber} />
    </g>
  );
}

function Body() {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, IN, (x) => x);
  const bx = interpolate(t, [0, 1], [140, TARGET.x]);
  const by = interpolate(t, [0, 1], [1300, TARGET.y - 30]) - Math.sin(t * Math.PI) * 420;
  const splash = frame >= IN ? pop(frame, IN) : 0;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {CUPS.map((c, i) => (
        <Cup key={i} x={c.x} y={c.y} hit={frame >= IN && c === TARGET} />
      ))}
      {frame < IN && <circle cx={bx} cy={by} r={44 - t * 14} fill={C.white} stroke={C.ink} strokeWidth={8} />}
      {splash > 0 &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <circle key={i} cx={TARGET.x + Math.cos(a) * 130 * splash} cy={TARGET.y - 40 + Math.sin(a) * 90 * splash} r={18 * (1.2 - splash * 0.6)} fill={C.white} stroke={C.ink} strokeWidth={5} />
          );
        })}
    </svg>
  );
}

export const beerPong: GameBody = { Body, stamp: "IN!!", stampBg: C.yellow, shakeAt: IN };
