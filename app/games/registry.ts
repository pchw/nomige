import { amidakuji } from "./amidakuji";
import { beerPong } from "./beer-pong";
import { bowling } from "./bowling";
import { glassSlide } from "./glass-slide";
import { greedyDice } from "./greedy-dice";
import { highLow } from "./high-low";
import { hitAndBlow } from "./hit-and-blow";
import { hundredOne } from "./hundred-one";
import { kabuttaraOut } from "./kabuttara-out";
import { liarsDice } from "./liars-dice";
import { minesweeper } from "./minesweeper";
import { russianRoulette } from "./russian-roulette";
import type { GameDefinition, GameId } from "./types";
import { wolfAndPigs } from "./wolf-and-pigs";

export const GAMES: Record<GameId, GameDefinition> = {
  "hundred-one": hundredOne,
  "liars-dice": liarsDice,
  "high-low": highLow,
  "kabuttara-out": kabuttaraOut,
  "wolf-and-pigs": wolfAndPigs,
  "greedy-dice": greedyDice,
  minesweeper,
  "glass-slide": glassSlide,
  bowling,
  "beer-pong": beerPong,
  "russian-roulette": russianRoulette,
  amidakuji,
  "hit-and-blow": hitAndBlow,
};

export const GAME_ORDER: GameId[] = [
  "wolf-and-pigs",
  "kabuttara-out",
  "high-low",
  "liars-dice",
  "hundred-one",
  "greedy-dice",
  "minesweeper",
  "glass-slide",
  "bowling",
  "beer-pong",
  "russian-roulette",
  "amidakuji",
  "hit-and-blow",
];

export function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && value in GAMES;
}

/** 設定値を configFields の選択肢に含まれるものだけに絞る */
export function sanitizeConfig(game: GameDefinition, input: Record<string, unknown>) {
  const config: Record<string, unknown> = { ...game.defaultConfig };
  for (const field of game.configFields) {
    const v = input[field.key];
    if (field.options.some((o) => o.value === v)) config[field.key] = v;
  }
  return config;
}
