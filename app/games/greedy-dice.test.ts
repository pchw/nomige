import { describe, expect, it } from "vitest";
import { greedyDice, type GreedyDiceState } from "./greedy-dice";
import { GameError } from "./types";
import { ctxAt, fixedCtx } from "./test-helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<GreedyDiceState> = {}): GreedyDiceState {
  const { state } = greedyDice.setup(players, greedyDice.defaultConfig, ctxAt(0));
  return { ...state, startIndex: 0, ...overrides };
}

/** 出目を指定する乱数（randInt(1, 6) で face が出る値） */
const face = (f: number) => fixedCtx(0, (f - 1) / 6 + 0.01);

describe("欲張りサイコロ", () => {
  it("振った目が今回の点に足される", () => {
    let s = setup();
    s = greedyDice.applyAction(s, "a", { type: "roll" }, face(4)).state;
    s = greedyDice.applyAction(s, "a", { type: "roll" }, face(6)).state;
    expect(s.turnTotal).toBe(10);
    expect(s.rolls).toEqual([[4], [6]]);
    expect(greedyDice.pendingPlayers(s)).toEqual(["a"]);
  });

  it("止めると点が確定して次の人の番", () => {
    let s = setup();
    s = greedyDice.applyAction(s, "a", { type: "roll" }, face(5)).state;
    s = greedyDice.applyAction(s, "a", { type: "stop" }, ctxAt(0)).state;
    expect(s.scores).toEqual({ a: 5 });
    expect(s.turnTotal).toBe(0);
    expect(greedyDice.pendingPlayers(s)).toEqual(["b"]);
    expect(s.lastTurn).toMatchObject({ playerId: "a", end: "stop", score: 5 });
  });

  it("1が出たら0点で次の人の番", () => {
    let s = setup();
    s = greedyDice.applyAction(s, "a", { type: "roll" }, face(6)).state;
    s = greedyDice.applyAction(s, "a", { type: "roll" }, face(1)).state;
    expect(s.scores).toEqual({ a: 0 });
    expect(s.lastTurn).toMatchObject({ end: "bust", score: 0, rolls: [[6], [1]] });
    expect(greedyDice.pendingPlayers(s)).toEqual(["b"]);
  });

  it("2個モードはどちらかが1ならアウト", () => {
    const { state } = greedyDice.setup(players, { dice: 2 }, ctxAt(0));
    const s = { ...state, startIndex: 0 };
    const step = greedyDice.applyAction(s, "a", { type: "roll" }, face(1));
    expect(step.state.rolls).toEqual([]);
    expect(step.state.lastTurn?.rolls).toEqual([[1, 1]]);
    expect(step.state.scores.a).toBe(0);
  });

  it("1回も振らずに止められない・手番以外は操作できない", () => {
    const s = setup();
    expect(() => greedyDice.applyAction(s, "a", { type: "stop" }, ctxAt(0))).toThrow(GameError);
    expect(() => greedyDice.applyAction(s, "b", { type: "roll" }, ctxAt(0))).toThrow(GameError);
  });

  it("開始プレイヤーから1周する", () => {
    const s = setup({ startIndex: 2 });
    expect(greedyDice.tableView(s).turnOrder).toEqual(["c", "a", "b"]);
    expect(greedyDice.pendingPlayers(s)).toEqual(["c"]);
  });

  it("全員終わったら最低点の人の負け", () => {
    const s = setup({ turnIndex: 2, scores: { a: 12, b: 3 }, rolls: [[5]], turnTotal: 5 });
    const step = greedyDice.applyAction(s, "c", { type: "stop" }, ctxAt(0));
    expect(step.result?.losers).toEqual(["b"]);
    expect(step.state.phase).toBe("done");
    expect(greedyDice.pendingPlayers(step.state)).toEqual([]);
  });

  it("最下位が同点ならルーレット", () => {
    const s = setup({ turnIndex: 2, scores: { a: 0, b: 7 } });
    const step = greedyDice.applyAction(s, "c", { type: "roll" }, face(1));
    expect(step.result?.tieBreak?.candidates).toEqual(["a", "c"]);
    expect(step.result?.losers).toHaveLength(1);
  });

  it("最下位の表示用に、終えた人の最低点を出す", () => {
    expect(greedyDice.tableView(setup()).lowest).toBeNull();
    expect(greedyDice.tableView(setup({ scores: { a: 8, b: 4 } })).lowest).toBe(4);
  });

  it("おまかせ：振っていなければ1回振り、振っていれば止める", () => {
    const first = greedyDice.autoAct(setup(), face(3));
    expect(first.state.rolls).toEqual([[3]]);
    const second = greedyDice.autoAct(first.state, ctxAt(0));
    expect(second.state.scores.a).toBe(3);
    expect(second.state.lastTurn?.auto).toBe(true);
  });
});
