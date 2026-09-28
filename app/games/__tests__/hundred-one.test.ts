import { describe, expect, it } from "vitest";
import { applyCard, buildDeck, hundredOne, type Card, type HundredOneState } from "../hundred-one";
import { GameError } from "../types";
import { ctxAt } from "./helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<HundredOneState> = {}): HundredOneState {
  const { state } = hundredOne.setup(players, hundredOne.defaultConfig, ctxAt(0));
  return { ...state, turnIndex: 0, ...overrides };
}

const num = (value: number, id = `n${value}`): Card => ({ id, kind: "num", value });

describe("101", () => {
  it("デッキは 56 枚、ショート版は +20 を抜いた 52 枚", () => {
    expect(buildDeck(101)).toHaveLength(56);
    expect(buildDeck(51)).toHaveLength(52);
    expect(buildDeck(51).some((c) => c.kind === "num" && c.value === 20)).toBe(false);
  });

  it("配札で各プレイヤーに3枚配る", () => {
    const s = setup();
    for (const p of players) expect(s.hands[p]).toHaveLength(3);
    expect(s.deck).toHaveLength(56 - 9);
  });

  it("カードの効果", () => {
    expect(applyCard(50, 101, num(7))).toBe(57);
    expect(applyCard(5, 101, { id: "x", kind: "pm10" }, -1)).toBe(0);
    expect(applyCard(50, 101, { id: "x", kind: "pm10" }, 1)).toBe(60);
    expect(applyCard(50, 101, { id: "x", kind: "max" })).toBe(101);
    expect(applyCard(50, 51, { id: "x", kind: "max" })).toBe(51);
  });

  it("出したら補充して次の人の番になる", () => {
    const s = setup({ hands: { a: [num(3)], b: [num(1)], c: [num(2)] } });
    const step = hundredOne.applyAction(s, "a", { type: "play", cardId: "n3" }, ctxAt(1000));
    expect(step.state.total).toBe(3);
    expect(step.state.hands.a).toHaveLength(1);
    expect(step.state.turnIndex).toBe(1);
    expect(step.timer).toEqual({ id: "turn", at: 11_000 });
  });

  it("101 ちょうどはセーフ、超えたら負け", () => {
    const safe = hundredOne.applyAction(
      setup({ total: 100, hands: { a: [num(1)], b: [num(1, "b1")], c: [] } }),
      "a",
      { type: "play", cardId: "n1" },
      ctxAt(0),
    );
    expect(safe.result).toBeUndefined();
    expect(safe.state.total).toBe(101);

    const bust = hundredOne.applyAction(safe.state, "b", { type: "play", cardId: "b1" }, ctxAt(0));
    expect(bust.result?.losers).toEqual(["b"]);
    expect(bust.state.phase).toBe("busted");
  });

  it("リターンで逆回りになる", () => {
    const s = setup({ hands: { a: [{ id: "r", kind: "return" }], b: [], c: [] } });
    const step = hundredOne.applyAction(s, "a", { type: "play", cardId: "r" }, ctxAt(0));
    expect(step.state.direction).toBe(-1);
    expect(step.state.turnIndex).toBe(2);
  });

  it("終盤は制限時間が5秒になる", () => {
    const s = setup({ total: 78, hands: { a: [num(3)], b: [], c: [] } });
    const step = hundredOne.applyAction(s, "a", { type: "play", cardId: "n3" }, ctxAt(0));
    expect(step.timer).toEqual({ id: "turn", at: 5000 });
  });

  it("±10 は符号が必要、手番以外は出せない", () => {
    const s = setup({ hands: { a: [{ id: "p", kind: "pm10" }], b: [num(1)], c: [] } });
    expect(() => hundredOne.applyAction(s, "a", { type: "play", cardId: "p" }, ctxAt(0))).toThrow(
      GameError,
    );
    expect(() => hundredOne.applyAction(s, "b", { type: "play", cardId: "n1" }, ctxAt(0))).toThrow(
      GameError,
    );
  });

  it("時間切れで自動的に1枚出す（±10 は -10）", () => {
    const s = setup({ total: 20, hands: { a: [{ id: "p", kind: "pm10" }], b: [], c: [] } });
    const step = hundredOne.onTimer(s, "turn", ctxAt(0));
    expect(step.state.total).toBe(10);
    expect(step.state.lastPlay?.auto).toBe(true);
  });

  it("山札が尽きたら捨て札を混ぜ直す", () => {
    const s = setup({ deck: [], discard: [num(9, "d9")], hands: { a: [num(1)], b: [], c: [] } });
    const step = hundredOne.applyAction(s, "a", { type: "play", cardId: "n1" }, ctxAt(0));
    const ids = [...step.state.hands.a, ...step.state.deck].map((c) => c.id).toSorted();
    expect(ids).toEqual(["d9", "n1"]);
    expect(step.state.hands.a).toHaveLength(1);
    expect(step.state.discard).toHaveLength(0);
  });

  it("手札の wouldBust を計算する", () => {
    const s = setup({ total: 95, hands: { a: [num(7), num(3, "n3")], b: [], c: [] } });
    const view = hundredOne.playerView(s, "a");
    expect(view.hand.map((c) => c.wouldBust)).toEqual([true, false]);
  });
});
