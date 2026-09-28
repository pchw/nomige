import type { GameId } from "./types";

/** 画面表示用のゲーム情報 */
export interface GameMeta {
  emoji: string;
  color: string;
  duration: string;
  style: string;
  rules: string[];
}

export const GAME_META: Record<GameId, GameMeta> = {
  "wolf-and-pigs": {
    emoji: "🐺",
    color: "var(--pink)",
    duration: "1分",
    style: "全員同時・正体隠し",
    rules: [
      "1人だけ秘密で狼になる。残りは子豚",
      "全員同時に、わら・木・レンガの家から1つ選ぶ（狼は襲う家を選ぶ）",
      "狼の家に子豚が1匹だけ → その子豚の負け",
      "2匹以上 → その子豚たちで延長戦",
      "誰もいない → 狼の負け",
    ],
  },
  "kabuttara-out": {
    emoji: "🐱",
    color: "var(--yellow)",
    duration: "1分",
    style: "全員同時・読み合い",
    rules: [
      "全員同時に動物を1匹選ぶ",
      "誰とも被らなかった人はセーフで抜ける",
      "抜けた人も「おじゃま役」として選び続け、被せにいける",
      "アプリも「のら動物」を1匹選ぶ",
      "最後まで残った1人の負け",
    ],
  },
  "high-low": {
    emoji: "🃏",
    color: "var(--blue)",
    duration: "1分",
    style: "全員同時・勘",
    rules: [
      "次にめくるカードを全員で予想する",
      "赤か黒か → 上か下か → 間か外か → マーク → 以降は上か下か",
      "当てた人から「降車」してセーフ",
      "全員当たり・全員外れのときは誰も降りない",
      "最後までバスに残った1人の負け",
    ],
  },
  "liars-dice": {
    emoji: "🎲",
    color: "var(--green)",
    duration: "1〜2分",
    style: "手番制・ブラフ",
    rules: [
      "自分のサイコロだけ見える",
      "「〇の目が△個以上ある」と、全員分のサイコロについて宣言する",
      "次の人は宣言を吊り上げるか、ダウト！",
      "1の目はどの目としても数える（ワイルド）",
      "ダウトで外した方の負け",
    ],
  },
  "hundred-one": {
    emoji: "💯",
    color: "var(--orange)",
    duration: "1〜2分",
    style: "手番制・カード",
    rules: [
      "手札から1枚出して場の合計に足していく",
      "±10・リターン（逆回り）・パス・101（ちょうど101にする）の特殊カードあり",
      "合計が101を超えるカードを出した人の負け（ちょうど101はセーフ）",
      "持ち時間10秒。終盤は5秒",
    ],
  },
};
