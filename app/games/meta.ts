import type { GameId } from "./types";

/** 画面表示用のゲーム情報 */
export interface GameMeta {
  emoji: string;
  color: string;
  duration: string;
  style: string;
}

export const GAME_META: Record<GameId, GameMeta> = {
  "wolf-and-pigs": {
    emoji: "🐺",
    color: "var(--pink)",
    duration: "1分",
    style: "全員同時・正体隠し",
  },
  "kabuttara-out": {
    emoji: "🐱",
    color: "var(--yellow)",
    duration: "1分",
    style: "全員同時・読み合い",
  },
  "high-low": {
    emoji: "🃏",
    color: "var(--blue)",
    duration: "1分",
    style: "全員同時・勘",
  },
  "liars-dice": {
    emoji: "🎲",
    color: "var(--green)",
    duration: "1〜2分",
    style: "手番制・ブラフ",
  },
  "hundred-one": {
    emoji: "💯",
    color: "var(--orange)",
    duration: "1〜2分",
    style: "手番制・カード",
  },
  "greedy-dice": {
    emoji: "🐔",
    color: "var(--red)",
    duration: "1〜2分",
    style: "手番制・度胸",
  },
  minesweeper: {
    emoji: "💣",
    color: "var(--purple)",
    duration: "1〜2分",
    style: "手番制・推理",
  },
  "glass-slide": {
    emoji: "🍺",
    color: "var(--amber)",
    duration: "1〜2分",
    style: "手番制・力加減",
  },
  bowling: {
    emoji: "🎳",
    color: "var(--teal)",
    duration: "1〜2分",
    style: "手番制・狙い",
  },
  "beer-pong": {
    emoji: "🏓",
    color: "var(--coral)",
    duration: "1〜3分",
    style: "勝ち抜け・狙い",
  },
};
