import { describe, expect, it } from "vitest";
import {
  bowling,
  isKnocked,
  KNOCK_DISTANCE,
  LANE_WIDTH,
  PINS,
  throwBall,
  type BowlingState,
} from "../bowling";
import { GameError } from "../types";
import { fixedCtx } from "./helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<BowlingState> = {}): BowlingState {
  const { state } = bowling.setup(players, bowling.defaultConfig, fixedCtx(0, 0));
  return { ...state, ...overrides };
}

/** ぶれなし（random = 0.5） */
const even = (now = 0) => fixedCtx(now, 0.5);

/** 投げて、演出が終わるまで進める */
function play(s: BowlingState, p: string, x: number, angle: number, power: number) {
  const step = bowling.applyAction(s, p, { type: "roll", x, angle, power }, even());
  return bowling.onTimer(step.state, "settle", even(step.timer!.at));
}

const CENTER = LANE_WIDTH / 2;
/** ほぼ倒れない投げ方（端ぎりぎりをまっすぐ） */
const EDGE = 6.5;

describe("ボウリング", () => {
  it("ピンは 1-2-3-4 の三角形に10本", () => {
    expect(PINS).toHaveLength(10);
    expect(PINS[0].y).toBeLessThan(PINS[9].y);
  });

  it("同じ投げ方なら同じ結果になる", () => {
    expect(throwBall(28, 1, 70)).toEqual(throwBall(28, 1, 70));
  });

  it("真ん中に投げるとピンが倒れ、ガターに落とすと0本", () => {
    expect(throwBall(CENTER, 0, 60).knocked.length).toBeGreaterThan(3);
    const gutter = throwBall(10, -8, 60);
    expect(gutter.gutter).toBe(true);
    expect(gutter.knocked).toHaveLength(0);
  });

  it("元の位置から動いたピン・レーンの外に出たピンは倒れた扱い", () => {
    const spot = PINS[0];
    expect(isKnocked(spot, spot.x, spot.y)).toBe(false);
    expect(isKnocked(spot, spot.x + KNOCK_DISTANCE - 0.1, spot.y)).toBe(false);
    expect(isKnocked(spot, spot.x + KNOCK_DISTANCE + 0.1, spot.y)).toBe(true);
    expect(isKnocked(spot, -1, spot.y)).toBe(true);
  });

  it("倒れたコマを記録し、そのコマで実際に元の位置から動いている", () => {
    const r = throwBall(LANE_WIDTH / 2 + 4, 0, 70);
    expect(r.knocked).toEqual(r.knockedAt.flatMap((f, i) => (f === null ? [] : [i])));
    r.knockedAt.forEach((f, i) => {
      if (f === null) return;
      const frame = r.frames[f];
      expect(isKnocked(PINS[i], frame[2 + 2 * i], frame[3 + 2 * i])).toBe(true);
      // その前のコマではまだ倒れていない
      const before = r.frames[f - 1];
      expect(isKnocked(PINS[i], before[2 + 2 * i], before[3 + 2 * i])).toBe(false);
    });
  });

  it("投げたら演出の間は誰も操作できず、終わったら次の人", () => {
    const s = setup();
    const step = bowling.applyAction(
      s,
      "a",
      { type: "roll", x: CENTER, angle: 0, power: 50 },
      even(1000),
    );
    expect(bowling.pendingPlayers(step.state)).toEqual([]);
    expect(step.state.scores.a).toBe(step.state.roll!.knocked.length);
    expect(() =>
      bowling.applyAction(
        step.state,
        "b",
        { type: "roll", x: CENTER, angle: 0, power: 50 },
        even(),
      ),
    ).toThrow(GameError);
    const next = bowling.onTimer(step.state, "settle", even(step.timer!.at));
    expect(bowling.pendingPlayers(next.state)).toEqual(["b"]);
  });

  it("手番以外は投げられない", () => {
    expect(() =>
      bowling.applyAction(setup(), "b", { type: "roll", x: CENTER, angle: 0, power: 50 }, even()),
    ).toThrow(GameError);
  });

  it("一番少ない人の負け", () => {
    let s = setup();
    s = play(s, "a", CENTER, 0, 60).state;
    s = play(s, "b", 10, -8, 60).state; // ガター
    const end = play(s, "c", CENTER, 0, 60);
    expect(end.result?.losers).toEqual(["b"]);
    // 結果画面では負けた人の1投（ガターで0本）を見せる
    const board = bowling.tableView(end.state).loserBoard;
    expect(board).toMatchObject({ playerId: "b", knocked: [], gutter: true });
    expect(board?.final).toHaveLength(2 + 2 * PINS.length);
  });

  it("最下位が並んだら、その人たちだけで延長戦", () => {
    let s = setup();
    s = play(s, "a", 10, -8, 60).state;
    s = play(s, "b", CENTER, 0, 60).state;
    const tie = play(s, "c", 10, -8, 60);
    expect(tie.result).toBeUndefined();
    expect(tie.state.rolloff).toBe(1);
    expect(tie.state.thrower).toEqual(["a", "c"]);
    expect(bowling.pendingPlayers(tie.state)).toEqual(["a"]);

    s = play(tie.state, "a", CENTER, 0, 60).state;
    const end = play(s, "c", 10, -8, 60);
    expect(end.result?.losers).toEqual(["c"]);
    expect(end.state.history).toHaveLength(2);
  });

  it("延長戦を3回やっても並んだらルーレット", () => {
    // 全員がガターで0本を続ける
    let s = setup();
    let result: ReturnType<typeof play>["result"];
    let rounds = 0;
    while (!result && rounds < 10) {
      for (const p of s.thrower) {
        const r = play(s, p, EDGE - 1, -8, 60);
        s = r.state;
        result = r.result;
      }
      rounds++;
    }
    expect(rounds).toBe(4);
    expect(bowling.tableView(s).loserBoard?.playerId).toBe(result?.losers[0]);
    expect(s.rolloff).toBe(3);
    expect(result?.tieBreak?.candidates).toHaveLength(3);
  });

  it("おまかせは真ん中からまっすぐ投げる", () => {
    const step = bowling.autoAct(setup(), even());
    expect(step.state.roll).toMatchObject({ x: CENTER, angle: 0, auto: true });
  });
});
