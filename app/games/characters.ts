export type AnimalId =
  | "cat"
  | "dog"
  | "rabbit"
  | "bear"
  | "fox"
  | "panda"
  | "penguin"
  | "frog"
  | "lion"
  | "owl";

export type CharacterId = AnimalId | "pig" | "wolf";

export interface Character {
  id: CharacterId;
  name: string;
  emoji: string;
  color: string;
}

export const CHARACTERS: Record<CharacterId, Character> = {
  cat: { id: "cat", name: "ネコ", emoji: "🐱", color: "#ffd23f" },
  dog: { id: "dog", name: "イヌ", emoji: "🐶", color: "#ff8a3d" },
  rabbit: { id: "rabbit", name: "ウサギ", emoji: "🐰", color: "#ff9ecf" },
  bear: { id: "bear", name: "クマ", emoji: "🐻", color: "#c98b5b" },
  fox: { id: "fox", name: "キツネ", emoji: "🦊", color: "#ff5c3d" },
  panda: { id: "panda", name: "パンダ", emoji: "🐼", color: "#e8e8e8" },
  penguin: { id: "penguin", name: "ペンギン", emoji: "🐧", color: "#5ec8ff" },
  frog: { id: "frog", name: "カエル", emoji: "🐸", color: "#7ee07e" },
  lion: { id: "lion", name: "ライオン", emoji: "🦁", color: "#ffb627" },
  owl: { id: "owl", name: "フクロウ", emoji: "🦉", color: "#b69cff" },
  pig: { id: "pig", name: "子豚", emoji: "🐷", color: "#ffb3c7" },
  wolf: { id: "wolf", name: "狼", emoji: "🐺", color: "#8a94a6" },
};

/** プレイヤーアイコン・被ったらアウトの選択肢に使う動物（子豚と狼は狼と子豚の役で使うため除く） */
export const ANIMALS: AnimalId[] = [
  "cat",
  "dog",
  "rabbit",
  "bear",
  "fox",
  "panda",
  "penguin",
  "frog",
  "lion",
  "owl",
];
