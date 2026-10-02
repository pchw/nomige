import type { ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Enter, ENTER_LEN } from "./fx/Enter";
import { GameCut } from "./scenes/GameCut";
import { Hook, Kanpai, LogoSlam, Phone } from "./scenes/Intro";
import { AllGames, EndCard, Features, Loser, Party, Roulette } from "./scenes/Outro";
import { C, ROOT_STYLE } from "./theme";
import { CUTS, SES, type Cut } from "./timeline";
import "../../app/app.css";

/** 効果音は1つずつ最大音量で書き出しているので、BGM に対して下げて鳴らす */
const SE_GAIN = 0.55;

function scene(cut: Cut): ReactNode {
  if (cut.id.startsWith("game:")) {
    return <GameCut id={cut.id.slice(5) as never} dur={cut.dur} />;
  }
  switch (cut.id) {
    case "hook":
      return <Hook />;
    case "phone":
      return <Phone />;
    case "kanpai":
      return <Kanpai />;
    case "logo":
      return <LogoSlam />;
    case "all-games":
      return <AllGames />;
    case "roulette":
      return <Roulette />;
    case "loser":
      return <Loser />;
    case "party":
      return <Party />;
    case "features":
      return <Features />;
    case "end":
      return <EndCard />;
  }
  return null;
}

/** 9:16 の本編。他のアスペクト比はこれを縮小して埋め込む */
export function Promo({ audio = true }: { audio?: boolean }) {
  return (
    <AbsoluteFill style={{ ...ROOT_STYLE, background: C.ink }}>
      {CUTS.map((cut, i) => {
        // 次のカットが被さってくる間（ENTER_LEN）は下に残しておく
        const next = CUTS[i + 1];
        const tail = next && next.enter !== "cut" ? ENTER_LEN : 0;
        return (
          <Sequence key={cut.id} from={cut.from} durationInFrames={cut.dur + tail} name={cut.id}>
            <Enter kind={cut.enter}>{scene(cut)}</Enter>
          </Sequence>
        );
      })}
      <Notice />
      {audio && (
        <>
          <Html5Audio src={staticFile("bgm/bgm.wav")} volume={1} />
          {SES.map((se, i) => (
            <Sequence key={i} from={se.frame} name={`se:${se.file}`}>
              <Html5Audio src={staticFile(`se/${se.file}.wav`)} volume={(se.volume ?? 1) * SE_GAIN} />
            </Sequence>
          ))}
        </>
      )}
    </AbsoluteFill>
  );
}

/** 常に出す注意書き（エンドカードでは本文に入れるので消す） */
function Notice() {
  const frame = useCurrentFrame();
  const end = CUTS[CUTS.length - 1];
  if (frame >= end.from) return null;
  return (
    <AbsoluteFill style={{ top: "auto", bottom: 46, height: 60, alignItems: "center", justifyContent: "center" }}>
      <span
        style={{
          padding: "6px 22px",
          background: "rgba(17,17,17,0.72)",
          color: C.white,
          borderRadius: 999,
          fontSize: 28,
        }}
      >
        お酒は20歳になってから。飲酒の強要はやめましょう。
      </span>
    </AbsoluteFill>
  );
}
