import { interpolate, useCurrentFrame } from "remotion";
import { PlayingCardView } from "~/components/games/HundredOneUI";
import { pop, ramp } from "../../fx/motion";
import { C, LINE, shadow } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Zoom } from "../parts";

const LAND = 5;

function Body() {
  const frame = useCurrentFrame();
  const over = frame >= LAND;
  const t = ramp(frame, 0, LAND, (x) => x * x);
  return (
    <>
      <At x={540} y={640}>
        <div
          style={{
            padding: "10px 70px",
            background: over ? C.red : C.white,
            color: over ? C.white : C.ink,
            border: LINE,
            borderRadius: 30,
            boxShadow: shadow(14),
            fontFamily: "var(--font-display)",
            fontSize: 240,
            lineHeight: 1.1,
            transform: `scale(${over ? 0.85 + 0.15 * pop(frame, LAND) : 1})`,
          }}
        >
          {over ? 105 : 95}
        </div>
      </At>
      <At
        x={540}
        y={interpolate(t, [0, 1], [1500, 1020])}
        style={{ transform: `translate(-50%, -50%) rotate(${(1 - t) * 30 - 4}deg)` }}
      >
        <Zoom z={3.2}>
          <PlayingCardView card={{ id: "promo", kind: "num", value: 10 }} limit={101} />
        </Zoom>
      </At>
    </>
  );
}

export const hundredOne: GameBody = { Body, stamp: "101超え！", stampBg: C.yellow, shakeAt: LAND };
