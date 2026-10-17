import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { GAME_META } from "~/games/meta";
import { GAME_ORDER, GAMES } from "~/games/registry";
import type { GameId } from "~/games/types";
import { DotBg } from "../fx/Bg";
import { pop, shakeOffset } from "../fx/motion";
import { Stamp } from "../fx/Stamp";
import { C, LINE, shadow } from "../theme";
import { BODIES } from "./games";

/**
 * ゲーム紹介の1カット。上にゲーム名の帯、中央にゲームの見せ場、下に一言スタンプ。
 * 背景色はアプリのゲームカードと同じ GAME_META の色。
 */
export function GameCut({ id, dur }: { id: GameId; dur: number }) {
  const frame = useCurrentFrame();
  const meta = GAME_META[id];
  const body = BODIES[id];
  const no = GAME_ORDER.indexOf(id) + 1;
  // 長いカット（狼と子豚）は見せ場もスタンプも後ろにずらす
  const slow = dur > 15;
  const stampAt = slow ? 17 : 8;
  const sh = shakeOffset(frame, body.shakeAt ?? -99, 26, 7, id);
  return (
    <DotBg color={meta.color} speed={5}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <Header emoji={meta.emoji} name={GAMES[id].name} no={no} />
        <body.Body />
        <AbsoluteFill
          style={{ top: 1300, height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Stamp at={stampAt} bg={body.stampBg ?? C.white} size={150} rotate={no % 2 ? -6 : 5}>
            {body.stamp}
          </Stamp>
        </AbsoluteFill>
      </AbsoluteFill>
    </DotBg>
  );
}

function Header({ emoji, name, no }: { emoji: string; name: string; no: number }) {
  const frame = useCurrentFrame();
  const p = pop(frame, 0, 12);
  return (
    <div
      style={{
        position: "absolute",
        top: 150,
        left: 60,
        right: 60,
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "22px 36px",
        background: C.ink,
        color: C.white,
        border: LINE,
        borderRadius: 28,
        boxShadow: shadow(14).replace(C.ink, C.white),
        transform: `translateX(${(1 - p) * -1200}px) rotate(-2deg)`,
      }}
    >
      <span style={{ fontSize: 110, lineHeight: 1 }}>{emoji}</span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: name.length > 6 ? 76 : 92,
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {name}
      </span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 44, color: C.yellow }}>
        {String(no).padStart(2, "0")}/13
      </span>
    </div>
  );
}

export interface GameBody {
  Body: () => ReactNode;
  stamp: string;
  stampBg?: string;
  /** このフレームで画面を揺らす */
  shakeAt?: number;
}
