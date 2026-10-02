import type { GameId } from "~/games/types";

/** カットの入り方 */
export type Enter = "cut" | "whip" | "iris" | "slide-up" | "zoom";

export type CutId =
  | "hook"
  | "phone"
  | "kanpai"
  | "logo"
  | `game:${GameId}`
  | "all-games"
  | "roulette"
  | "loser"
  | "party"
  | "features"
  | "end";

export interface Cut {
  id: CutId;
  from: number;
  dur: number;
  enter: Enter;
}

/** 120BPM / 30fps なので 1拍 = 15f。カットはすべて拍の頭で切り替える */
export const BEAT = 15;
export const TOTAL = 450;

const GAME_CUTS: [GameId, number, Enter][] = [
  ["wolf-and-pigs", 30, "zoom"],
  ["liars-dice", 15, "whip"],
  ["high-low", 15, "iris"],
  ["russian-roulette", 15, "whip"],
  ["beer-pong", 15, "slide-up"],
  ["glass-slide", 15, "whip"],
  ["bowling", 15, "iris"],
  ["minesweeper", 15, "whip"],
  ["hundred-one", 15, "slide-up"],
  ["amidakuji", 15, "whip"],
  ["greedy-dice", 15, "iris"],
  ["hit-and-blow", 15, "whip"],
  ["kabuttara-out", 15, "slide-up"],
];

function build(): Cut[] {
  const cuts: Cut[] = [];
  let at = 0;
  const push = (id: CutId, dur: number, enter: Enter) => {
    cuts.push({ id, from: at, dur, enter });
    at += dur;
  };
  // ACT 1 掴み
  push("hook", 15, "cut");
  push("phone", 15, "cut");
  push("kanpai", 15, "cut");
  push("logo", 15, "zoom");
  // ACT 2 ゲーム連打
  for (const [id, dur, enter] of GAME_CUTS) push(`game:${id}`, dur, enter);
  push("all-games", 15, "iris");
  // ACT 3 負け → 盛り上がり
  push("roulette", 30, "slide-up");
  push("loser", 30, "cut");
  push("party", 30, "iris");
  // ACT 4 CTA
  push("features", 30, "whip");
  push("end", 45, "zoom");
  if (at !== TOTAL) throw new Error(`timeline is ${at}f, expected ${TOTAL}f`);
  return cuts;
}

export const CUTS = build();

/** 効果音。frame は全体のフレーム番号 */
export interface Se {
  frame: number;
  file: string;
  volume?: number;
}

const at = (id: CutId) => CUTS.find((c) => c.id === id)!.from;

export const SES: Se[] = [
  { frame: 0, file: "boom" },
  { frame: at("phone") + 6, file: "thud" },
  { frame: at("kanpai") + 5, file: "clink" },
  { frame: at("logo") + 3, file: "boom" },
  // ゲームのカット：入りで風切り、スタンプでポン
  ...CUTS.filter((c) => c.id.startsWith("game:")).flatMap((c) => [
    { frame: c.from, file: "whoosh", volume: 0.5 },
    { frame: c.from + (c.dur > 15 ? 17 : 8), file: "pop", volume: 0.8 },
  ]),
  { frame: at("game:minesweeper") + 6, file: "explosion", volume: 0.7 },
  { frame: at("game:high-low") + 5, file: "flip", volume: 0.8 },
  ...Array.from({ length: 13 }, (_, i) => ({
    frame: at("all-games") + i,
    file: "tick",
    volume: 0.35,
  })),
  { frame: at("roulette") + 22, file: "hit" },
  { frame: at("loser"), file: "boom" },
  { frame: at("loser") + 10, file: "pop" },
  { frame: at("party"), file: "cheer", volume: 0.8 },
  { frame: at("features"), file: "pop" },
  { frame: at("features") + 10, file: "pop" },
  { frame: at("features") + 20, file: "pop" },
  { frame: at("end") + 2, file: "boom" },
  { frame: at("end") + 8, file: "chime", volume: 0.8 },
];

/** 全体フレームから今のカットを引く */
export function cutAt(frame: number): Cut {
  return CUTS.find((c) => frame >= c.from && frame < c.from + c.dur) ?? CUTS[CUTS.length - 1];
}
