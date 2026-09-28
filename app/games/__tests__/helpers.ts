import { createRng } from "../random";
import type { Ctx } from "../types";

export function ctxAt(now: number, seed = 1): Ctx {
  return { now, random: createRng(seed).random };
}

/** 常に同じ値を返す乱数（配列の先頭を選ばせたいときなど） */
export function fixedCtx(now: number, value = 0): Ctx {
  return { now, random: () => value };
}
