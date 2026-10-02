import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { GAME_META } from "~/games/meta";
import type { GameId } from "~/games/types";
import { DotBg } from "./fx/Bg";
import { Kicker, Logo } from "./scenes/Intro";
import { Promo } from "./Promo";
import { C, HEIGHT, LINE, ROOT_STYLE, shadow, WIDTH } from "./theme";
import { cutAt } from "./timeline";

const CUT_COLOR: Record<string, string> = {
  hook: C.ink,
  phone: C.yellow,
  kanpai: C.pink,
  logo: C.paper,
  "all-games": C.paper,
  roulette: C.yellow,
  loser: C.red,
  party: C.mint,
  features: C.blue,
  end: C.paper,
};

/** 1:1 / 16:9 用。9:16 の本編を中央に置き、左右を今のカットの色で埋める */
export function Framed() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = height / HEIGHT;
  const cut = cutAt(frame);
  const color = cut.id.startsWith("game:")
    ? GAME_META[cut.id.slice(5) as GameId].color
    : CUT_COLOR[cut.id];
  const side = (width - WIDTH * scale) / 2;
  const wide = side > 400;
  return (
    <AbsoluteFill style={ROOT_STYLE}>
      <DotBg color={color} speed={3} />
      {wide && (
        <>
          <AbsoluteFill style={{ width: side, alignItems: "center", justifyContent: "center", gap: 30 }}>
            <Logo size={108} />
            <Kicker size={40}>スマホで飲みゲー</Kicker>
          </AbsoluteFill>
          <AbsoluteFill style={{ left: "auto", width: side, alignItems: "center", justifyContent: "center" }}>
            <div style={{ padding: "18px 30px", background: C.ink, color: C.yellow, border: LINE, borderRadius: 20, boxShadow: shadow(10).replace(C.ink, C.white), fontFamily: "var(--font-display)", fontSize: 50 }}>
              nomige.pchw.dev
            </div>
          </AbsoluteFill>
        </>
      )}
      <div
        style={{
          position: "absolute",
          left: side,
          top: 0,
          width: WIDTH,
          height: HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          overflow: "hidden",
          outline: `${8 / scale}px solid ${C.ink}`,
        }}
      >
        <Promo />
      </div>
    </AbsoluteFill>
  );
}
