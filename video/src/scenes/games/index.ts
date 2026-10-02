import type { GameId } from "~/games/types";
import type { GameBody } from "../GameCut";
import { amidakuji } from "./Amidakuji";
import { beerPong } from "./BeerPong";
import { bowling } from "./Bowling";
import { glassSlide } from "./GlassSlide";
import { greedyDice } from "./GreedyDice";
import { highLow } from "./HighLow";
import { hitAndBlow } from "./HitAndBlow";
import { hundredOne } from "./HundredOne";
import { kabuttaraOut } from "./KabuttaraOut";
import { liarsDice } from "./LiarsDice";
import { minesweeper } from "./Minesweeper";
import { russianRoulette } from "./RussianRoulette";
import { wolfAndPigs } from "./WolfAndPigs";

export const BODIES: Record<GameId, GameBody> = {
  "wolf-and-pigs": wolfAndPigs,
  "liars-dice": liarsDice,
  "high-low": highLow,
  "russian-roulette": russianRoulette,
  "beer-pong": beerPong,
  "glass-slide": glassSlide,
  bowling,
  minesweeper,
  "hundred-one": hundredOne,
  amidakuji,
  "greedy-dice": greedyDice,
  "hit-and-blow": hitAndBlow,
  "kabuttara-out": kabuttaraOut,
};
