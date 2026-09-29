import { describe, expect, it } from "vitest";
import { biteSize, poisonChoco, remaining, type PoisonChocoState } from "../poison-choco";
import { GameError } from "../types";
import { ctxAt } from "./helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<PoisonChocoState> = {}): PoisonChocoState {
  const { state } = poisonChoco.setup(players, poisonChoco.defaultConfig, ctxAt(0));
  return { ...state, turnIndex: 0, ...overrides };
}

const eat = (s: PoisonChocoState, p: string, col: number, row: number) =>
  poisonChoco.applyAction(s, p, { type: "eat", col, row }, ctxAt(0));

describe("毒入りチョコ", () => {
  it("中サイズは 6×5 の30かけ", () => {
    const s = setup();
    expect(s.heights).toEqual([5, 5, 5, 5, 5, 5]);
    expect(remaining(s.heights)).toBe(30);
  });

  it("選んだかけらから右上をまとめて食べる", () => {
    const s = setup();
    expect(biteSize(s.heights, 3, 2)).toBe(9);
    const step = eat(s, "a", 3, 2);
    expect(step.state.heights).toEqual([5, 5, 5, 2, 2, 2]);
    expect(step.state.lastBite).toMatchObject({ playerId: "a", eaten: 9 });
    expect(poisonChoco.pendingPlayers(step.state)).toEqual(["b"]);
  });

  it("もうないマス・手番以外は選べない", () => {
    const s = setup({ heights: [5, 5, 5, 2, 2, 2] });
    expect(() => eat(s, "a", 4, 3)).toThrow(GameError);
    expect(() => eat(s, "b", 0, 1)).toThrow(GameError);
  });

  it("毒はほかがなくなるまで選べない", () => {
    expect(() => eat(setup({ heights: [2, 0, 0, 0, 0, 0] }), "a", 0, 0)).toThrow(GameError);
  });

  it("毒しか残っていなければ食べるしかなく、食べた人の負け", () => {
    const step = eat(setup({ heights: [1, 0, 0, 0, 0, 0] }), "a", 0, 0);
    expect(step.result?.losers).toEqual(["a"]);
    expect(step.state.phase).toBe("poisoned");
  });

  it("おまかせは一番右の列のてっぺんを1かけ", () => {
    const step = poisonChoco.autoAct(setup({ heights: [5, 4, 2, 0, 0, 0] }), ctxAt(0));
    expect(step.state.heights).toEqual([5, 4, 1, 0, 0, 0]);
    expect(step.state.lastBite?.auto).toBe(true);
  });

  it("おまかせでも毒しかなければ毒を食べる", () => {
    const step = poisonChoco.autoAct(setup({ heights: [1, 0, 0, 0, 0, 0] }), ctxAt(0));
    expect(step.result?.losers).toEqual(["a"]);
  });
});
