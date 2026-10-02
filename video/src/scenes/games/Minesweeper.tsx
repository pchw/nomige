import { useCurrentFrame } from "remotion";
import { Flash } from "../../fx/Bg";
import { pop } from "../../fx/motion";
import { C, LINE } from "../../theme";
import type { GameBody } from "../GameCut";
import { At } from "../parts";

const OPEN = 3;
const BOOM = 5;
const BOMB = 6;
const NUMBERS: Record<number, string> = { 0: "1", 1: "1", 4: "2", 8: "1", 9: "2", 12: "1" };

function Body() {
  const frame = useCurrentFrame();
  const burst = frame >= BOOM ? pop(frame, BOOM, 14) : 0;
  return (
    <>
      <At x={540} y={880} style={{ display: "grid", gridTemplateColumns: "repeat(4, 190px)", gap: 14 }}>
        {Array.from({ length: 16 }, (_, i) => {
          const isBomb = i === BOMB;
          const open = i in NUMBERS || (isBomb && frame >= OPEN);
          return (
            <div
              key={i}
              style={{
                height: 190,
                background: isBomb && open ? C.red : open ? C.paper : C.purple,
                border: LINE,
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontSize: 100,
                boxShadow: open ? "none" : `inset -10px -10px 0 rgba(17,17,17,0.25)`,
              }}
            >
              {isBomb && open ? "💣" : (NUMBERS[i] ?? "")}
            </div>
          );
        })}
      </At>
      {burst > 0 && (
        <At x={642} y={778} style={{ transform: `translate(-50%, -50%) scale(${burst * 1.4}) rotate(${frame * 6}deg)` }}>
          <svg width={900} height={900} viewBox="-100 -100 200 200">
            <polygon
              points={Array.from({ length: 24 }, (_, k) => {
                const r = k % 2 ? 50 : 95;
                const a = (k / 24) * Math.PI * 2;
                return `${Math.cos(a) * r},${Math.sin(a) * r}`;
              }).join(" ")}
              fill={C.yellow}
              stroke={C.ink}
              strokeWidth={4}
            />
            <circle r={36} fill={C.orange} stroke={C.ink} strokeWidth={4} />
          </svg>
        </At>
      )}
      <Flash at={BOOM} />
    </>
  );
}

export const minesweeper: GameBody = { Body, stamp: "ドカン！", stampBg: C.white, shakeAt: BOOM };
