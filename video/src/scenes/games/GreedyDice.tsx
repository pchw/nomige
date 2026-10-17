import { useCurrentFrame } from "remotion";
import { Die } from "~/components/games/LiarsDiceUI";
import type { Face as DieFace } from "~/games/liars-dice";
import { pop } from "../../fx/motion";
import { C, LINE, shadow } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Face, Zoom } from "../parts";

/** 振るたびに出た目。最後に 1 が出て 0 点 */
const ROLLS: DieFace[] = [6, 4, 5, 1];
const BUST = 6;

function Body() {
  const frame = useCurrentFrame();
  const i = Math.min(ROLLS.length - 1, Math.floor(frame / 2));
  const bust = frame >= BUST;
  const score = bust ? 0 : ROLLS.slice(0, i + 1).reduce((s, v) => s + v, 0);
  return (
    <>
      <At x={250} y={640}>
        <Face character="frog" size={200} />
      </At>
      <At x={710} y={640}>
        <div
          style={{
            padding: "6px 50px",
            background: bust ? C.ink : C.white,
            color: bust ? C.red : C.ink,
            border: LINE,
            borderRadius: 26,
            boxShadow: shadow(12),
            fontFamily: "var(--font-display)",
            fontSize: 150,
            whiteSpace: "nowrap",
          }}
        >
          {score}点
        </div>
      </At>
      <At x={540} y={1000} style={{ transform: `translate(-50%, -50%) rotate(${bust ? 0 : frame * 47}deg) scale(${bust ? 0.8 + 0.2 * pop(frame, BUST) : 1})` }}>
        <Zoom z={5.5}>
          <Die face={bust ? 1 : ROLLS[i]} hit={bust} />
        </Zoom>
      </At>
    </>
  );
}

export const greedyDice: GameBody = { Body, stamp: "欲張りすぎ…", stampBg: C.white, shakeAt: BUST };
