import { interpolate, useCurrentFrame } from "remotion";
import { pop } from "../../fx/motion";
import { C, LINE, shadow } from "../../theme";
import type { GameBody } from "../GameCut";
import { At, Face } from "../parts";

const HOUSES = [
  { emoji: "🌾", label: "わら", pigs: 1 },
  { emoji: "🪵", label: "木", pigs: 2 },
  { emoji: "🧱", label: "レンガ", pigs: 1 },
];
const LAND = 12;

function Body() {
  const frame = useCurrentFrame();
  const drop = interpolate(pop(frame, 6, 9), [0, 1], [-900, 0]);
  return (
    <>
      {HOUSES.map((h, i) => {
        const x = 220 + i * 320;
        const hit = i === 1 && frame >= LAND;
        return (
          <At key={h.label} x={x} y={900} style={{ transform: `translate(-50%, -50%) scale(${pop(frame, i * 2)})` }}>
            <div
              style={{
                width: 280,
                height: 300,
                background: hit ? C.red : C.white,
                border: LINE,
                borderRadius: 24,
                boxShadow: shadow(12),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 130, lineHeight: 1 }}>{h.emoji}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 52 }}>{h.label}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
              {Array.from({ length: h.pigs }, (_, k) => (
                <Face
                  key={k}
                  character="pig"
                  size={110}
                  style={{ transform: hit ? `translateY(${-Math.abs(Math.sin((frame + k) * 1.4)) * 40}px)` : undefined }}
                />
              ))}
            </div>
          </At>
        );
      })}
      {frame >= 6 && (
        <At x={540} y={590 + drop}>
          <Face character="wolf" size={230} />
        </At>
      )}
    </>
  );
}

export const wolfAndPigs: GameBody = { Body, stamp: "そこか！", stampBg: C.yellow, shakeAt: LAND };
