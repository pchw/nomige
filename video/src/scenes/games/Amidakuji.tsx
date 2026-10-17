import { useCurrentFrame } from "remotion";
import { CHARACTERS, type AnimalId } from "~/games/characters";
import { ramp } from "../../fx/motion";
import { C } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Face } from "../parts";

const COLS = 5;
const ROWS = 7;
const X0 = 180;
const DX = 180;
const Y0 = 560;
const Y1 = 1180;
const START = 1;
const WHO: AnimalId[] = ["cat", "fox", "panda", "frog", "owl"];
/** [段, 左の縦線] */
const RUNGS: [number, number][] = [
  [0, 1], [0, 3], [1, 0], [1, 2], [2, 3], [3, 1], [4, 2], [4, 0], [5, 3], [6, 2],
];

const x = (c: number) => X0 + c * DX;
const y = (r: number) => Y0 + ((r + 0.5) / ROWS) * (Y1 - Y0);

function tracePath(start: number) {
  let c = start;
  const pts: [number, number][] = [[x(c), Y0]];
  for (let r = 0; r < ROWS; r++) {
    const right = RUNGS.some(([rr, g]) => rr === r && g === c);
    const left = RUNGS.some(([rr, g]) => rr === r && g === c - 1);
    if (right || left) {
      pts.push([x(c), y(r)]);
      c += right ? 1 : -1;
      pts.push([x(c), y(r)]);
    }
  }
  pts.push([x(c), Y1]);
  return { pts, end: c };
}

const PATH = tracePath(START);
const LEN = PATH.pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - PATH.pts[i][0], p[1] - PATH.pts[i][1]), 0);
const DONE = 8;

function Body() {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, DONE, (v) => v);
  const color = CHARACTERS[WHO[START]].color;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: COLS }, (_, c) => (
          <line key={c} x1={x(c)} x2={x(c)} y1={Y0} y2={Y1} stroke={C.ink} strokeWidth={10} strokeLinecap="round" />
        ))}
        {RUNGS.map(([r, g], i) => (
          <line key={i} x1={x(g)} x2={x(g + 1)} y1={y(r)} y2={y(r)} stroke={C.ink} strokeWidth={10} strokeLinecap="round" />
        ))}
        <polyline
          points={PATH.pts.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={26}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - t)}
        />
        <polyline
          points={PATH.pts.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={C.ink}
          strokeWidth={6}
          strokeDasharray={LEN}
          strokeDashoffset={LEN * (1 - t)}
        />
      </svg>
      {WHO.map((id, c) => (
        <At key={id} x={x(c)} y={Y0 - 80}>
          <Face character={id} size={130} style={{ transform: c === START ? "scale(1.2)" : undefined }} />
        </At>
      ))}
      {Array.from({ length: COLS }, (_, c) => (
        <At
          key={c}
          x={x(c)}
          y={Y1 + 80}
          style={{
            width: 150,
            height: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: c === PATH.end ? (frame >= DONE ? C.yellow : C.white) : C.white,
            border: `6px solid ${C.ink}`,
            borderRadius: 16,
            fontSize: c === PATH.end ? 80 : 40,
            fontFamily: "var(--font-display)",
            transform: `translate(-50%, -50%) scale(${c === PATH.end && frame >= DONE ? 1.25 : 1})`,
          }}
        >
          {c === PATH.end ? "🍺" : "セーフ"}
        </At>
      ))}
    </>
  );
}

export const amidakuji: GameBody = { Body, stamp: "当たり〜！", stampBg: C.yellow, shakeAt: DONE };
