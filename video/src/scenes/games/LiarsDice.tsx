import { random, useCurrentFrame } from "remotion";
import { Die } from "~/components/games/LiarsDiceUI";
import type { Face as DieFace } from "~/games/liars-dice";
import { ramp } from "../../fx/motion";
import { C, LINE, shadow } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Zoom } from "../parts";

const FINAL: DieFace[] = [3, 5, 3, 1, 3];
const SETTLE = 6;

function Body() {
  const frame = useCurrentFrame();
  return (
    <>
      <At x={540} y={560}>
        <div
          style={{
            padding: "16px 44px",
            background: C.white,
            border: LINE,
            borderRadius: 60,
            boxShadow: shadow(10),
            fontFamily: "var(--font-display)",
            fontSize: 72,
            whiteSpace: "nowrap",
          }}
        >
          「3が4個！」
        </div>
      </At>
      <At x={540} y={900} style={{ display: "flex", gap: 34 }}>
        {FINAL.map((face, i) => {
          const t = ramp(frame, 0, SETTLE + i * 0.5);
          const rolling = frame < SETTLE;
          const shown = rolling ? ((Math.floor(random(`d${i}${Math.floor(frame / 2)}`) * 6) + 1) as DieFace) : face;
          return (
            <Zoom key={i} z={3.4}>
              <span style={{ display: "inline-flex", transform: `translateY(${(1 - t) * -120 * (i % 2 ? 1 : -1)}px) rotate(${(1 - t) * 540 * (i % 2 ? 1 : -1)}deg)` }}>
                <Die face={shown} hit={!rolling && (face === 3 || face === 1)} />
              </span>
            </Zoom>
          );
        })}
      </At>
    </>
  );
}

export const liarsDice: GameBody = { Body, stamp: "ダウト！", stampBg: C.red, shakeAt: SETTLE };
