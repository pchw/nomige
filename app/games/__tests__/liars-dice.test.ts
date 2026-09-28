import { describe, expect, it } from "vitest";
import { countFace, liarsDice, minimumBid, type LiarsDiceState } from "../liars-dice";
import { GameError } from "../types";
import { ctxAt } from "./helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<LiarsDiceState> = {}): LiarsDiceState {
  const { state } = liarsDice.setup(players, liarsDice.defaultConfig, ctxAt(0));
  return {
    ...state,
    turnIndex: 0,
    dice: { a: [1, 2, 3, 4, 5], b: [2, 2, 6, 6, 6], c: [1, 3, 3, 5, 5] },
    ...overrides,
  };
}

describe("ライアーダイス", () => {
  it("人数に応じてサイコロの個数を決める", () => {
    expect(liarsDice.setup(players, liarsDice.defaultConfig, ctxAt(0)).state.totalDice).toBe(15);
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(liarsDice.setup(six, liarsDice.defaultConfig, ctxAt(0)).state.totalDice).toBe(18);
  });

  it("1 はワイルドとして数える", () => {
    const s = setup();
    expect(countFace(s.dice, 5, true)).toBe(5);
    expect(countFace(s.dice, 5, false)).toBe(3);
  });

  it("最小の吊り上げ", () => {
    expect(minimumBid(undefined, 15, true)).toEqual({ count: 1, face: 2 });
    expect(minimumBid({ count: 3, face: 4 }, 15, true)).toEqual({ count: 3, face: 5 });
    expect(minimumBid({ count: 3, face: 6 }, 15, true)).toEqual({ count: 4, face: 2 });
    expect(minimumBid({ count: 15, face: 6 }, 15, true)).toBeNull();
  });

  it("弱い宣言・ワイルドの 1 の宣言は不可", () => {
    let s = setup();
    s = liarsDice.applyAction(s, "a", { type: "bid", count: 3, face: 4 }, ctxAt(0)).state;
    expect(() =>
      liarsDice.applyAction(s, "b", { type: "bid", count: 3, face: 3 }, ctxAt(0)),
    ).toThrow(GameError);
    expect(() =>
      liarsDice.applyAction(s, "b", { type: "bid", count: 4, face: 1 }, ctxAt(0)),
    ).toThrow(GameError);
  });

  it("最初の手番ではダウトできない", () => {
    expect(() => liarsDice.applyAction(setup(), "a", { type: "doubt" }, ctxAt(0))).toThrow(
      GameError,
    );
  });

  it("宣言が正しければダウトした人の負け", () => {
    let s = setup();
    // 6 の目は 3 個 + ワイルド 2 個 = 5 個
    s = liarsDice.applyAction(s, "a", { type: "bid", count: 5, face: 6 }, ctxAt(0)).state;
    const step = liarsDice.applyAction(s, "b", { type: "doubt" }, ctxAt(0));
    expect(step.result?.losers).toEqual(["b"]);
    expect(step.state.challenge?.actual).toBe(5);
  });

  it("宣言が嘘なら宣言した人の負け", () => {
    let s = setup();
    s = liarsDice.applyAction(s, "a", { type: "bid", count: 6, face: 6 }, ctxAt(0)).state;
    const step = liarsDice.applyAction(s, "b", { type: "doubt" }, ctxAt(0));
    expect(step.result?.losers).toEqual(["a"]);
  });

  it("時間切れは最小の吊り上げ、吊り上げ不可なら自動ダウト", () => {
    const s = setup({ bids: [{ playerId: "c", count: 3, face: 6, auto: false }] });
    const step = liarsDice.onTimer(s, "turn", ctxAt(0));
    expect(step.state.bids.at(-1)).toMatchObject({ playerId: "a", count: 4, face: 2, auto: true });

    const maxed = setup({ bids: [{ playerId: "c", count: 15, face: 6, auto: false }] });
    expect(liarsDice.onTimer(maxed, "turn", ctxAt(0)).result?.losers).toEqual(["c"]);
  });

  it("他人のサイコロはプレイヤービューに含まれない", () => {
    const view = liarsDice.playerView(setup(), "a");
    expect(view.myDice).toEqual([1, 2, 3, 4, 5]);
    expect(JSON.stringify(liarsDice.tableView(setup()))).not.toContain('dice":{');
  });
});
