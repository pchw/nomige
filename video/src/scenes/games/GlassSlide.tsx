import { interpolate, useCurrentFrame } from "remotion";
import { ramp } from "../../fx/motion";
import { C, LINE } from "../../theme";
import type { GameBody } from "../GameCut";
import { At } from "../parts";

const STOP = 9;
const EDGE = 940;

function Body() {
  const frame = useCurrentFrame();
  const t = ramp(frame, 0, STOP, (x) => 1 - Math.pow(1 - x, 3));
  const x = interpolate(t, [0, 1], [-60, EDGE - 110]);
  const speed = frame < STOP ? 1 - t : 0;
  // 止まったあとに端でぐらつく
  const wobble = frame >= STOP ? Math.sin((frame - STOP) * 1.6) * 7 * Math.exp(-(frame - STOP) / 5) : 0;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: -40,
          width: EDGE + 40,
          top: 940,
          height: 200,
          background: "#c98b5b",
          border: LINE,
          borderRadius: "0 20px 20px 0",
          boxShadow: `0 14px 0 ${C.ink}`,
        }}
      />
      <div style={{ position: "absolute", left: EDGE - 28, top: 940, width: 20, height: 200, background: C.red, borderLeft: LINE }} />
      {speed > 0.05 &&
        [0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: x - 260 * speed - i * 30, top: 780 + i * 50, width: 220 * speed, height: 14, background: C.ink, borderRadius: 7 }} />
        ))}
      <At x={x} y={850} style={{ fontSize: 230, lineHeight: 1, transform: `translate(-50%, -50%) rotate(${wobble}deg)`, transformOrigin: "50% 100%" }}>
        🍺
      </At>
      <At x={EDGE - 50} y={1210} style={{ fontFamily: "var(--font-display)", fontSize: 54, whiteSpace: "nowrap" }}>
        ← 端ギリギリ
      </At>
    </>
  );
}

export const glassSlide: GameBody = { Body, stamp: "ギリ！", stampBg: C.yellow, shakeAt: STOP };
