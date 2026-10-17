import { useCurrentFrame } from "remotion";
import { Trump } from "~/components/games/HighLowUI";
import { pop } from "../../fx/motion";
import { C } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Zoom } from "../parts";

const FLIP = 5;

function Body() {
  const frame = useCurrentFrame();
  // めくる：横幅を 1→0→1 にして途中で表に切り替える
  const sx = frame < FLIP - 2 ? 1 : frame < FLIP ? 1 - (frame - (FLIP - 2)) / 2 : Math.min(1, (frame - FLIP + 1) / 2);
  return (
    <>
      <At x={290} y={880} style={{ transform: `translate(-50%, -50%) rotate(-6deg)` }}>
        <Zoom z={4.2}>
          <Trump card={{ suit: "S", rank: 7 }} />
        </Zoom>
      </At>
      <At x={540} y={880} style={{ fontFamily: "var(--font-display)", fontSize: 130, color: C.ink, transform: `translate(-50%, -50%) translateY(${(1 - pop(frame, 2)) * 60}px)` }}>
        ▲
      </At>
      <At x={790} y={850} style={{ transform: `translate(-50%, -50%) rotate(6deg) scaleX(${sx}) scale(${frame >= FLIP ? 0.9 + 0.1 * pop(frame, FLIP) : 1})` }}>
        <Zoom z={4.2}>
          <Trump card={frame >= FLIP ? { suit: "H", rank: 13 } : null} />
        </Zoom>
      </At>
    </>
  );
}

export const highLow: GameBody = { Body, stamp: "HIGH!", stampBg: C.yellow, shakeAt: FLIP };
