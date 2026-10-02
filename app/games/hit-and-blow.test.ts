import { describe, expect, it } from "vitest";
import {
  MARKS,
  SHOW_MS,
  bestScores,
  hitAndBlow,
  judge,
  maxGuessesFor,
  type HitAndBlowState,
} from "./hit-and-blow";
import { GameError } from "./types";
import { ctxAt } from "./test-helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<HitAndBlowState> = {}): HitAndBlowState {
  const { state } = hitAndBlow.setup(players, hitAndBlow.defaultConfig, ctxAt(0));
  return { ...state, turnIndex: 0, answer: [0, 1, 1, 2], ...overrides };
}

const act = (
  s: HitAndBlowState,
  playerId: string,
  action: Parameters<typeof hitAndBlow.applyAction>[2],
) => hitAndBlow.applyAction(s, playerId, action, ctxAt(0));

/** 上から順にマークを置いて予想する */
function guess(s: HitAndBlowState, playerId: string, marks: number[]) {
  for (const mark of marks) s = act(s, playerId, { type: "put", mark }).state;
  return act(s, playerId, { type: "guess" });
}

describe("ヒット&ブロー", () => {
  it("● は位置も合っている数、○ は位置違いの数。同じマークは重ねて数えない", () => {
    expect(judge([0, 1, 1, 2], [1, 1, 4, 0])).toEqual({ hits: 1, blows: 2 });
    expect(judge([0, 1, 1, 2], [0, 1, 1, 2])).toEqual({ hits: 4, blows: 0 });
    expect(judge([0, 0, 0, 0], [0, 1, 1, 1])).toEqual({ hits: 1, blows: 0 });
    expect(judge([1, 2, 3, 4], [4, 3, 2, 1])).toEqual({ hits: 0, blows: 4 });
    expect(judge([1, 1, 2, 2], [2, 2, 2, 1])).toEqual({ hits: 1, blows: 2 });
  });

  it("設定でマスの数が変わり、予想できる回数も増える", () => {
    for (const slots of [4, 5, 6] as const) {
      const { state } = hitAndBlow.setup(players, { slots }, ctxAt(0));
      expect(state.answer).toHaveLength(slots);
      expect(state.draft).toHaveLength(slots);
      expect(state.maxGuesses).toBe(maxGuessesFor(slots));
      for (const m of state.answer) expect(m >= 0 && m < MARKS.length).toBe(true);
    }
    expect(maxGuessesFor(5)).toBeGreaterThan(maxGuessesFor(4));
  });

  it("答えは決着までクライアントに送らない", () => {
    const s = setup();
    expect(hitAndBlow.tableView(s).answer).toBeNull();
    expect(JSON.stringify(hitAndBlow.tableView(s))).not.toContain('answer":[');
    expect(JSON.stringify(hitAndBlow.playerView(s, "a"))).not.toContain("answer");
  });

  it("マークは上のマスから埋まり、タップしたマスを消すとそこに次のマークが入る", () => {
    let s = setup();
    s = act(s, "a", { type: "put", mark: 3 }).state;
    s = act(s, "a", { type: "put", mark: 3 }).state;
    s = act(s, "a", { type: "put", mark: 5 }).state;
    expect(s.draft).toEqual([3, 3, 5, null]);
    s = act(s, "a", { type: "clear", slot: 1 }).state;
    s = act(s, "a", { type: "put", mark: 0 }).state;
    expect(s.draft).toEqual([3, 0, 5, null]);
    // 並べ途中も全員に見える
    expect(hitAndBlow.tableView(s).draft).toEqual([3, 0, 5, null]);
  });

  it("手番以外・埋まっていない予想・不正なマークは受け付けない", () => {
    const s = setup();
    expect(() => act(s, "b", { type: "put", mark: 0 })).toThrow(GameError);
    expect(() => act(s, "a", { type: "guess" })).toThrow(GameError);
    expect(() => act(s, "a", { type: "put", mark: 6 })).toThrow(GameError);
    expect(() => act(s, "a", { type: "put", mark: 1.5 })).toThrow(GameError);
    expect(() => act(s, "a", { type: "clear", slot: 4 })).toThrow(GameError);
    let full = s;
    for (let i = 0; i < 4; i++) full = act(full, "a", { type: "put", mark: 0 }).state;
    expect(() => act(full, "a", { type: "put", mark: 0 })).toThrow(GameError);
  });

  it("予想するとヒントが付いて席順に次の人へ回る", () => {
    const step = guess(setup({ turnIndex: 2 }), "c", [1, 1, 4, 0]);
    expect(step.state.guesses[0]).toMatchObject({ playerId: "c", hits: 1, blows: 2 });
    expect(step.state.draft).toEqual([null, null, null, null]);
    expect(hitAndBlow.pendingPlayers(step.state)).toEqual(["a"]);
    expect(hitAndBlow.tableView(step.state).nextPlayerId).toBe("b");
    expect(hitAndBlow.tableView(step.state).scores).toEqual({ a: null, b: null, c: 4 });
  });

  it("各自の点数は一番良かった予想（●2点・○1点）", () => {
    let s = setup();
    s = guess(s, "a", [1, 1, 4, 0]).state; // ●1 ○2 → 4点
    s = guess(s, "b", [3, 3, 3, 3]).state; // 0点
    s = guess(s, "c", [0, 4, 4, 4]).state; // ●1 → 2点
    s = guess(s, "a", [3, 3, 3, 0]).state; // ○1 → 1点（最高点は 4 のまま）
    expect(bestScores(s)).toEqual({ a: 4, b: 0, c: 2 });
  });

  it("正解が出たら答えを見せ、正解者以外で一番低い人が負け", () => {
    let s = setup();
    s = guess(s, "a", [1, 1, 4, 0]).state; // 4点
    s = guess(s, "b", [3, 3, 3, 3]).state; // 0点
    const step = guess(s, "c", [0, 1, 1, 2]);
    expect(step.state.phase).toBe("shown");
    expect(step.state.solvedBy).toBe("c");
    expect(step.result).toBeUndefined();
    expect(step.timer).toEqual({ id: "finish", at: SHOW_MS });
    expect(hitAndBlow.pendingPlayers(step.state)).toEqual([]);
    expect(hitAndBlow.tableView(step.state).answer).toEqual([0, 1, 1, 2]);

    const end = hitAndBlow.onTimer(step.state, "finish", ctxAt(SHOW_MS));
    expect(end.state.phase).toBe("done");
    expect(end.result?.losers).toEqual(["b"]);
    expect(end.result?.reason).toContain("0点");
  });

  it("同点ならルーレット", () => {
    let s = setup({ order: ["a", "b", "c", "d"] });
    s = guess(s, "a", [3, 3, 3, 3]).state;
    s = guess(s, "b", [4, 4, 4, 4]).state;
    s = guess(s, "c", [1, 1, 4, 0]).state;
    s = guess(s, "d", [0, 1, 1, 2]).state;
    const end = hitAndBlow.onTimer(s, "finish", ctxAt(SHOW_MS));
    expect(end.result?.tieBreak?.candidates).toEqual(["a", "b"]);
    expect(["a", "b"]).toContain(end.result?.losers[0]);
  });

  it("まだ予想していない人は対象外。誰も予想していなければ正解者以外の全員でルーレット", () => {
    let s = setup();
    s = guess(s, "a", [3, 3, 3, 3]).state;
    const early = hitAndBlow.onTimer(guess(s, "b", [0, 1, 1, 2]).state, "finish", ctxAt(0));
    expect(early.result?.losers).toEqual(["a"]);

    const first = hitAndBlow.onTimer(guess(setup(), "a", [0, 1, 1, 2]).state, "finish", ctxAt(0));
    expect(first.result?.tieBreak?.candidates).toEqual(["b", "c"]);
  });

  it("予想を使い切ったら答えを開示して、全員の中で一番低い人が負け", () => {
    let s = setup({ maxGuesses: 3 });
    s = guess(s, "a", [1, 1, 4, 0]).state;
    s = guess(s, "b", [0, 4, 4, 4]).state;
    const step = guess(s, "c", [3, 3, 3, 3]);
    expect(step.state.phase).toBe("shown");
    expect(step.state.solvedBy).toBeNull();
    const end = hitAndBlow.onTimer(step.state, "finish", ctxAt(SHOW_MS));
    expect(end.result?.losers).toEqual(["c"]);
    expect(end.result?.reason).toContain("使い切って");
  });

  it("おまかせは並べ途中のマスを残して空きをランダムに埋めて予想する", () => {
    let s = setup();
    s = act(s, "a", { type: "put", mark: 5 }).state;
    const step = hitAndBlow.autoAct(s, ctxAt(0));
    const g = step.state.guesses[0];
    expect(g.playerId).toBe("a");
    expect(g.auto).toBe(true);
    expect(g.marks[0]).toBe(5);
    expect(g.marks).toHaveLength(4);
    expect(hitAndBlow.pendingPlayers(step.state)).toEqual(["b"]);
  });

  it("答えのマークは偏らない", () => {
    const counts = Array(MARKS.length).fill(0);
    for (let seed = 1; seed <= 300; seed++) {
      for (const m of hitAndBlow.setup(players, { slots: 4 }, ctxAt(0, seed)).state.answer)
        counts[m]++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(140);
  });
});
