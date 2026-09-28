import type { PlayerId, TieBreak } from "./types";

/** mulberry32。状態を数値1つで持てるので Durable Object に保存しやすい */
export function createRng(seed: number): { random: () => number; state: () => number } {
  let a = seed >>> 0;
  return {
    random() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state: () => a,
  };
}

export function randInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

export function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 同点者からルーレットで1人を選ぶ */
export function tieBreak(random: () => number, candidates: PlayerId[]): TieBreak {
  return { candidates: [...candidates], chosen: pick(random, candidates) };
}
