import { useCurrentFrame } from "remotion";
import { pop } from "../../fx/motion";
import { C, LINE, shadow } from "../../theme";
import type { GameBody } from "../GameCut";
import { At } from "../parts";

const REVEAL = 5;
const BAD = 3;

function Body() {
  const frame = useCurrentFrame();
  return (
    <At x={540} y={880} style={{ display: "grid", gridTemplateColumns: "repeat(3, 270px)", gap: 30 }}>
      {Array.from({ length: 6 }, (_, i) => {
        const open = frame >= REVEAL + (i === BAD ? 0 : 1);
        const bad = i === BAD;
        const wobble = frame < REVEAL ? Math.sin(frame * 2.5 + i) * 8 : 0;
        return (
          <div
            key={i}
            style={{
              height: 270,
              background: open ? (bad ? C.red : C.white) : C.amber,
              border: LINE,
              borderRadius: 24,
              boxShadow: shadow(10),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: `rotate(${wobble}deg) scale(${bad && open ? 0.9 + 0.2 * pop(frame, REVEAL) : 1})`,
              opacity: open && !bad ? 0.55 : 1,
            }}
          >
            <span style={{ fontSize: 140, lineHeight: 1 }}>🥃</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 44, color: bad && open ? C.white : C.ink }}>
              {open ? (bad ? "ハズレ" : "セーフ") : `${i + 1}`}
            </span>
          </div>
        );
      })}
    </At>
  );
}

export const russianRoulette: GameBody = { Body, stamp: "ハズレ！", stampBg: C.yellow, shakeAt: REVEAL };
