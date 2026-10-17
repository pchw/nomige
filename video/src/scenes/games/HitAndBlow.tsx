import { useCurrentFrame } from "remotion";
import { Mark, Pegs } from "~/components/games/HitAndBlowUI";
import { pop } from "../../fx/motion";
import { C, LINE, shadow } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Zoom } from "../parts";

const GUESS = [0, 3, 1, 4];
const PEGS = 5;

function Body() {
  const frame = useCurrentFrame();
  return (
    <>
      <At x={540} y={720} style={{ display: "flex", gap: 26 }}>
        {GUESS.map((m, i) => (
          <span key={i} style={{ display: "inline-flex", transform: `scale(${pop(frame, i)}) rotate(${(1 - pop(frame, i)) * 40}deg)` }}>
            <Zoom z={4.4}>
              <Mark mark={m} />
            </Zoom>
          </span>
        ))}
      </At>
      <At x={540} y={1040} style={{ transform: `translate(-50%, -50%) scale(${frame >= PEGS ? pop(frame, PEGS) : 0})` }}>
        <div style={{ padding: "18px 40px", background: C.white, border: LINE, borderRadius: 28, boxShadow: shadow(12) }}>
          <Zoom z={6}>
            <Pegs hits={3} blows={0} slots={GUESS.length} />
          </Zoom>
        </div>
      </At>
    </>
  );
}

export const hitAndBlow: GameBody = { Body, stamp: "3ヒット！", stampBg: C.yellow, shakeAt: PEGS };
