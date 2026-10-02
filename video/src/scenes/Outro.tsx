import QRCode from "qrcode";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ANIMALS, type AnimalId } from "~/games/characters";
import { GAME_META } from "~/games/meta";
import { GAME_ORDER, GAMES } from "~/games/registry";
import { Confetti } from "../fx/Confetti";
import { DotBg, Flash, SpeedLines } from "../fx/Bg";
import { pop, shakeOffset } from "../fx/motion";
import { BigText, Stamp } from "../fx/Stamp";
import { C, LINE, shadow } from "../theme";
import { Kicker, Logo } from "./Intro";
import { At, Column, Face } from "./parts";

export const SITE_URL = "https://nomige.pchw.dev";

/** 全13ゲームが一斉に並ぶ */
export function AllGames() {
  const frame = useCurrentFrame();
  return (
    <DotBg color={C.paper} speed={5}>
      <At x={540} y={940} style={{ display: "grid", gridTemplateColumns: "repeat(3, 310px)", gap: 24 }}>
        {GAME_ORDER.map((id, i) => {
          const p = pop(frame, i * 0.7, 11);
          return (
            <div
              key={id}
              style={{
                height: 250,
                background: GAME_META[id].color,
                border: LINE,
                borderRadius: 22,
                boxShadow: shadow(10),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transform: `scale(${p}) rotate(${(1 - p) * (i % 2 ? 30 : -30)}deg)`,
              }}
            >
              <span style={{ fontSize: 110, lineHeight: 1 }}>{GAME_META[id].emoji}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 38, whiteSpace: "nowrap" }}>
                {GAMES[id].name}
              </span>
            </div>
          );
        })}
      </At>
      <Column>
        <Stamp at={6} bg={C.yellow} size={190} rotate={-8}>
          全13種！
        </Stamp>
      </Column>
    </DotBg>
  );
}

const STOP = 22;
const LOSER: AnimalId = "bear";
const REEL = 104;

/** 負ける人をスロットで決める */
export function Roulette() {
  const frame = useCurrentFrame();
  // 止まったときに LOSER が真ん中に来るよう、リールの並びと移動量を決める
  const order = Array.from({ length: 40 }, (_, i) => ANIMALS[i % ANIMALS.length]);
  const target = order.lastIndexOf(LOSER, 34);
  const pos = interpolate(frame, [0, STOP], [target - 26, target], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const ITEM = 300;
  const sh = shakeOffset(frame, STOP, 26, 7, "roulette");
  const blur = frame < STOP ? Math.min(14, (STOP - frame) * 1.2) : 0;
  return (
    <DotBg color={C.yellow} speed={6}>
      <Column gap={80} style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <BigText size={130} color={C.white} shadowColor={C.pink}>
          負けたのは…？
        </BigText>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <span style={{ fontSize: 120, fontFamily: "var(--font-display)" }}>▶</span>
          <div
            style={{
              width: 420,
              height: ITEM * 1.6,
              background: C.white,
              border: `12px solid ${C.ink}`,
              borderRadius: 40,
              boxShadow: shadow(18),
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: ITEM * 0.8 - ITEM / 2 - pos * ITEM,
                filter: blur ? `blur(${blur}px)` : undefined,
              }}
            >
              {order.map((id, i) => (
                <div key={i} style={{ height: ITEM, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Face character={id} size={230} />
                </div>
              ))}
            </div>
          </div>
          <span style={{ fontSize: 120, fontFamily: "var(--font-display)" }}>◀</span>
        </div>
        <div style={{ height: REEL }} />
      </Column>
    </DotBg>
  );
}

/** 負けた人が決まる。飲む量の強要はせず「+1杯」の表示とノンアルOKを添える */
export function Loser() {
  const frame = useCurrentFrame();
  const sh = shakeOffset(frame, 0, 34, 9, "loser");
  return (
    <DotBg color={C.red} dot="rgba(255,255,255,0.18)" speed={6}>
      <SpeedLines color={C.white} opacity={0.4} />
      <Column gap={40} style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ transform: `scale(${0.4 + 0.6 * pop(frame, 0, 8)})` }}>
          <Face character={LOSER} size={480} />
        </div>
        <Stamp at={3} bg={C.yellow} size={200} rotate={-7}>
          負け！
        </Stamp>
        <div
          style={{
            transform: `scale(${pop(frame, 10)})`,
            padding: "14px 50px",
            background: C.white,
            border: LINE,
            borderRadius: 999,
            boxShadow: shadow(12),
            fontFamily: "var(--font-display)",
            fontSize: 96,
            whiteSpace: "nowrap",
          }}
        >
          🍺 +1杯
        </div>
        <div style={{ opacity: frame >= 14 ? 1 : 0, fontFamily: "var(--font-display)", fontSize: 52, color: C.white, WebkitTextStroke: `8px ${C.ink}`, paintOrder: "stroke fill" }}>
          ※ソフドリ・ノンアルでもOK
        </div>
      </Column>
      <Flash at={0} />
    </DotBg>
  );
}

const PARTY: AnimalId[] = ["cat", "dog", "rabbit", "bear", "fox", "panda", "penguin", "lion"];

/** みんなで盛り上がる */
export function Party() {
  const frame = useCurrentFrame();
  return (
    <DotBg color={C.mint} speed={6}>
      {PARTY.map((id, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const jump = Math.abs(Math.sin(frame * 0.45 + i * 0.9)) * 110;
        return (
          <At key={id} x={165 + col * 250} y={1060 + row * 300 - jump} style={{ transform: `translate(-50%, -50%) rotate(${Math.sin(frame * 0.5 + i) * 12}deg) scale(${pop(frame, i * 0.8)})` }}>
            <Face character={id} size={210} />
          </At>
        );
      })}
      <At x={540} y={560} style={{ transform: `translate(-50%, -50%) scale(${1.6 - 0.6 * pop(frame, 0, 9)}) rotate(-4deg)` }}>
        <BigText size={150} color={C.yellow} shadowColor={C.ink}>
          盛り上がり
          <br />
          確定<span style={{ WebkitTextStroke: 0, textShadow: "none" }}>🎉</span>
        </BigText>
      </At>
      <Confetti />
    </DotBg>
  );
}

const FEATURES = [
  { title: "登録不要", sub: "URLを開くだけ", color: C.yellow },
  { title: "アプリ不要", sub: "ブラウザで遊べる", color: C.blue },
  { title: "2〜10人", sub: "スマホでもタブレット1台でも", color: C.pink },
];

/** 特長を10フレームずつ連打 */
export function Features() {
  const frame = useCurrentFrame();
  const i = Math.min(FEATURES.length - 1, Math.floor(frame / 10));
  const f = FEATURES[i];
  const local = frame - i * 10;
  return (
    <DotBg color={f.color} speed={8}>
      <Column gap={60}>
        <Stamp key={i} at={i * 10} size={200} rotate={i % 2 ? 5 : -5}>
          {f.title}
        </Stamp>
        <div style={{ transform: `translateY(${(1 - pop(local, 1)) * 200}px)`, opacity: pop(local, 1) }}>
          <Kicker size={62}>{f.sub}</Kicker>
        </div>
      </Column>
    </DotBg>
  );
}

const QR = QRCode.create(SITE_URL, { errorCorrectionLevel: "M" });

function QrCode({ size }: { size: number }) {
  const n = QR.modules.size;
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill={C.white} />
      {Array.from({ length: n * n }, (_, k) =>
        QR.modules.data[k] ? <rect key={k} x={k % n} y={Math.floor(k / n)} width={1} height={1} fill={C.ink} /> : null,
      )}
    </svg>
  );
}

/** エンドカード：ロゴ・URL・QR。最後は止めて読ませる */
export function EndCard() {
  const frame = useCurrentFrame();
  const sh = shakeOffset(frame, 2, 24, 7, "end");
  const pulse = 1 + Math.max(0, Math.sin(frame * 0.5)) * 0.04;
  return (
    <DotBg color={C.paper} speed={2}>
      <Column gap={70} style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, paddingBottom: 120 }}>
        <div style={{ transform: `scale(${pop(frame, 6)})` }}>
          <Kicker size={64}>スマホで遊ぶ飲みゲー 全13種</Kicker>
        </div>
        <div style={{ transform: `scale(${2.2 - 1.2 * pop(frame, 0, 9)})` }}>
          <Logo size={180} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 40, transform: `translateY(${(1 - pop(frame, 9)) * 900}px)` }}>
          <div style={{ border: LINE, borderRadius: 24, boxShadow: shadow(14), overflow: "hidden", background: C.white, padding: 8 }}>
            <QrCode size={340} />
          </div>
          <div
            style={{
              padding: "26px 40px",
              background: C.pink,
              border: LINE,
              borderRadius: 24,
              boxShadow: shadow(14),
              fontFamily: "var(--font-display)",
              fontSize: 64,
              lineHeight: 1.25,
              transform: `scale(${pulse})`,
            }}
          >
            今すぐ
            <br />
            無料で遊ぶ ▶
          </div>
        </div>
        <div
          style={{
            transform: `translateY(${(1 - pop(frame, 12)) * 900}px)`,
            padding: "18px 44px",
            background: C.ink,
            color: C.yellow,
            borderRadius: 20,
            fontFamily: "var(--font-display)",
            fontSize: 96,
            whiteSpace: "nowrap",
          }}
        >
          nomige.pchw.dev
        </div>
      </Column>
      <AbsoluteFill style={{ top: "auto", bottom: 70, height: 120, alignItems: "center", justifyContent: "center", fontSize: 34, color: C.ink, textAlign: "center", lineHeight: 1.6 }}>
        お酒は20歳になってから。飲酒の強要・一気飲みはやめましょう。
        <br />
        飲めない人はソフトドリンクで楽しもう。
      </AbsoluteFill>
    </DotBg>
  );
}
