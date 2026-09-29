import { describe, expect, it } from "vitest";
import {
  glassSlide,
  reach,
  shotDurationMs,
  START_Y,
  TABLE_LENGTH,
  type GlassSlideState,
} from "../glass-slide";
import { body, simulate } from "../physics";
import { GameError } from "../types";
import { ctxAt, fixedCtx } from "./helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<GlassSlideState> = {}): GlassSlideState {
  const { state } = glassSlide.setup(players, glassSlide.defaultConfig, ctxAt(0));
  return { ...state, startIndex: 0, ...overrides };
}

/** ムラなし（random = 0.5 で倍率 1） */
const even = (now = 0) => fixedCtx(now, 0.5);

const slide = (s: GlassSlideState, p: string, x: number, power: number, now = 0) =>
  glassSlide.applyAction(s, p, { type: "slide", x, power }, even(now));

/** 滑らせて、止まるまで進める */
function play(s: GlassSlideState, p: string, x: number, power: number) {
  const step = slide(s, p, x, power);
  return glassSlide.onTimer(step.state, "settle", even(step.timer!.at));
}

/** 止まっているグラスに斜めから当てる配置 */
const collisionBodies = () => [
  body({ x: 50, y: 150, r: 5, m: 1, friction: 100 }),
  body({ x: 47, y: 10, vy: 180, r: 5, m: 1, friction: 100 }),
];
const opts = { isOut: () => false, restitution: 0.85 };

const powerFor = (distanceFromEdge: number) => (TABLE_LENGTH - distanceFromEdge - START_Y) / 2.4;

describe("グラスすべらせ", () => {
  it("ムラなしなら reach(power) だけ進んで止まる", () => {
    const step = slide(setup(), "a", 50, 50);
    const g = step.state.glasses.find((x) => x.playerId === "a")!;
    expect(g.y).toBeCloseTo(START_Y + reach(50), -0.5);
    expect(g.x).toBe(50);
    expect(g.fallen).toBe(false);
  });

  it("滑っている間は誰も操作できず、演出が終わったら次の人", () => {
    const step = slide(setup(), "a", 50, 50, 1000);
    expect(glassSlide.pendingPlayers(step.state)).toEqual([]);
    expect(step.timer!.at).toBeGreaterThan(1000 + shotDurationMs(step.state.shot!));
    expect(() => slide(step.state, "b", 50, 50)).toThrow(GameError);
    const next = glassSlide.onTimer(step.state, "settle", even(step.timer!.at));
    expect(glassSlide.pendingPlayers(next.state)).toEqual(["b"]);
  });

  it("強すぎると奥の端から落ちる", () => {
    const step = slide(setup(), "a", 50, 100);
    expect(step.state.glasses[0].fallen).toBe(true);
  });

  it("手番以外は滑らせられない", () => {
    expect(() => slide(setup(), "b", 50, 50)).toThrow(GameError);
  });

  it("ムラで止まる位置がぶれる", () => {
    const low = glassSlide.applyAction(
      setup(),
      "a",
      { type: "slide", x: 50, power: 60 },
      fixedCtx(0, 0),
    );
    const high = glassSlide.applyAction(
      setup(),
      "a",
      { type: "slide", x: 50, power: 60 },
      fixedCtx(0, 0.999),
    );
    expect(low.state.glasses[0].y).toBeLessThan(high.state.glasses[0].y);
  });

  it("正面から当てると、止まっていたグラスが押し出されて落ちる", () => {
    const s = setup({
      glasses: [{ playerId: "a", x: 50, y: TABLE_LENGTH - 4, fallen: false }],
      turnIndex: 1,
    });
    const step = slide(s, "b", 50, 95);
    const a = step.state.glasses.find((g) => g.playerId === "a")!;
    const b = step.state.glasses.find((g) => g.playerId === "b")!;
    expect(a.fallen).toBe(true);
    expect(b.fallen).toBe(false);
  });

  it("物理計算は同じ入力なら同じ軌跡になる", () => {
    expect(simulate(collisionBodies(), opts)).toEqual(simulate(collisionBodies(), opts));
  });

  it("誰も落ちなければ一番遠い人の負け", () => {
    let s = setup();
    s = play(s, "a", 20, powerFor(10)).state;
    s = play(s, "b", 50, powerFor(60)).state;
    const end = play(s, "c", 80, powerFor(30));
    expect(end.result?.losers).toEqual(["b"]);
    expect(end.state.phase).toBe("done");
  });

  it("落ちた人がいればその人の負け", () => {
    let s = setup();
    s = play(s, "a", 20, powerFor(10)).state;
    s = play(s, "b", 50, 100).state;
    const end = play(s, "c", 80, powerFor(80));
    expect(end.result?.losers).toEqual(["b"]);
  });

  it("落ちた人が複数ならルーレット", () => {
    let s = setup();
    s = play(s, "a", 20, 100).state;
    s = play(s, "b", 50, 100).state;
    const end = play(s, "c", 80, powerFor(80));
    expect(end.result?.tieBreak?.candidates).toEqual(["a", "b"]);
  });

  it("おまかせは控えめに滑らせる", () => {
    const step = glassSlide.autoAct(setup(), even());
    const g = step.state.glasses[0];
    expect(g.fallen).toBe(false);
    expect(TABLE_LENGTH - g.y).toBeGreaterThan(30);
    expect(step.state.shot?.auto).toBe(true);
  });
});
