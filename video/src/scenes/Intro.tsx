import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DotBg, Flash, SpeedLines } from "../fx/Bg";
import { pop, ramp, shakeOffset } from "../fx/motion";
import { BigText, Stamp } from "../fx/Stamp";
import { C, LINE, shadow } from "../theme";
import { Column, Face } from "./parts";

/** 1. 黒地に「飲み会で、」を叩きつける */
export function Hook() {
  const frame = useCurrentFrame();
  const s = 1.6 - 0.6 * pop(frame, 0, 8);
  const sh = shakeOffset(frame, 2, 22, 6, "hook");
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Column>
        <div style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${s})` }}>
          <BigText size={210} color={C.white} shadowColor={C.pink} stroke={0}>
            飲み会で、
          </BigText>
        </div>
      </Column>
    </AbsoluteFill>
  );
}

/** 2. スマホが落ちてくる */
export function Phone() {
  const frame = useCurrentFrame();
  const drop = interpolate(pop(frame, 0, 11), [0, 1], [-1500, 0]);
  const sh = shakeOffset(frame, 6, 26, 7, "phone");
  return (
    <DotBg color={C.yellow}>
      <Column gap={70} style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ transform: `rotate(-3deg) scale(${1.3 - 0.3 * pop(frame, 0)})` }}>
          <BigText size={150} color={C.white} shadowColor={C.pink}>
            スマホ出して！
          </BigText>
        </div>
        <div
          style={{
            transform: `translateY(${drop}px) rotate(${(1 - pop(frame, 0)) * -25 + 6}deg)`,
            width: 470,
            height: 900,
            borderRadius: 70,
            border: `16px solid ${C.ink}`,
            background: C.paper,
            boxShadow: shadow(24),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 46,
          }}
        >
          <Logo size={76} />
          <div style={{ display: "flex", gap: 14 }}>
            <Face character="cat" size={100} />
            <Face character="dog" size={100} />
            <Face character="rabbit" size={100} />
          </div>
          <div
            style={{
              padding: "18px 40px",
              background: C.pink,
              border: LINE,
              borderRadius: 16,
              boxShadow: shadow(8),
              fontFamily: "var(--font-display)",
              fontSize: 48,
            }}
          >
            あそぶ ▶
          </div>
        </div>
      </Column>
    </DotBg>
  );
}

/** 3. ジョッキで乾杯 */
export function Kanpai() {
  const frame = useCurrentFrame();
  const IMPACT = 5;
  const t = ramp(frame, 0, IMPACT, (x) => x * x);
  const back = frame >= IMPACT ? Math.sin((frame - IMPACT) * 0.9) * 24 * Math.exp(-(frame - IMPACT) / 4) : 0;
  const x = interpolate(t, [0, 1], [700, 150]) + back;
  const sh = shakeOffset(frame, IMPACT, 30, 7, "kanpai");
  return (
    <DotBg color={C.pink}>
      {frame >= IMPACT && <SpeedLines color={C.white} opacity={0.55} />}
      <Column gap={40} style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ position: "relative", width: 1080, height: 560 }}>
          {[-1, 1].map((side) => (
            <div
              key={side}
              style={{
                position: "absolute",
                left: 540 + side * x,
                top: 280,
                fontSize: 380,
                lineHeight: 1,
                transform: `translate(-50%, -50%) scaleX(${-side}) rotate(${-18 - (frame >= IMPACT ? 6 : 0)}deg)`,
              }}
            >
              🍺
            </div>
          ))}
        </div>
        <Stamp at={IMPACT} bg={C.yellow} size={140} rotate={-5}>
          カンパーイ!!
        </Stamp>
      </Column>
      <Flash at={IMPACT} />
    </DotBg>
  );
}

/** アプリのヘッダーと同じロゴ（NOMI は黒、GE は白抜き） */
export function Logo({ size = 300 }: { size?: number }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: "-0.02em",
        color: C.ink,
        textShadow: `${size * 0.05}px ${size * 0.05}px 0 ${C.pink}`,
        whiteSpace: "nowrap",
      }}
    >
      NOMI
      <span
        style={{
          color: C.white,
          WebkitTextStroke: `${size * 0.035}px ${C.ink}`,
          paintOrder: "stroke fill",
          textShadow: `${size * 0.05}px ${size * 0.05}px 0 ${C.blue}`,
        }}
      >
        GE
      </span>
    </div>
  );
}

export function Kicker({ children, size = 64 }: { children: string; size?: number }) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * 0.2}px ${size * 0.5}px`,
        background: C.ink,
        color: C.yellow,
        fontFamily: "var(--font-display)",
        fontSize: size,
        letterSpacing: "0.12em",
        transform: "rotate(-3deg)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

/** 4. ロゴを叩きつける */
export function LogoSlam() {
  const frame = useCurrentFrame();
  const p = pop(frame, 0, 9);
  const sh = shakeOffset(frame, 3, 34, 8, "logo");
  return (
    <DotBg color={C.paper} speed={4}>
      <Column gap={50} style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ transform: `translateY(${(1 - pop(frame, 4)) * -300}px)` }}>
          <Kicker size={70}>スマホで飲みゲー</Kicker>
        </div>
        <div style={{ transform: `scale(${3 - 2 * p}) rotate(${(1 - p) * -12}deg)` }}>
          <Logo size={180} />
        </div>
      </Column>
    </DotBg>
  );
}
