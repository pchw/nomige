import { describe, expect, it } from "vitest";
import {
  aimAt,
  beerPong,
  CATCH_RADIUS,
  initialCups,
  judge,
  landingPoint,
  type BeerPongState,
} from "./beer-pong";
import { GameError } from "./types";
import { fixedCtx } from "./test-helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<BeerPongState> = {}): BeerPongState {
  const { state } = beerPong.setup(players, beerPong.defaultConfig, fixedCtx(0, 0));
  return { ...state, ...overrides };
}

/** ぶれなし（random = 0.5） */
const even = (now = 0) => fixedCtx(now, 0.5);

function play(s: BeerPongState, p: string, aim: { angle: number; power: number }) {
  const step = beerPong.applyAction(s, p, { type: "throw", ...aim }, even());
  return beerPong.onTimer(step.state, "settle", even(step.timer!.at));
}

const cups = initialCups();
const atCup = (id: number) => aimAt(cups[id]);
const MISS = { angle: -12, power: 0 };

describe("ビアポン", () => {
  it("カップは10個", () => {
    expect(cups).toHaveLength(10);
  });

  it("カップを狙う方向と強さは、その場所に落ちる", () => {
    const aim = atCup(7);
    const land = landingPoint(aim.angle, aim.power);
    expect(Math.hypot(land.x - cups[7].x, land.y - cups[7].y)).toBeLessThan(0.01);
  });

  it("中心の近くなら入る、縁なら弾かれる、遠ければ外れ", () => {
    expect(judge(cups, { x: cups[0].x, y: cups[0].y - CATCH_RADIUS + 0.1 }).result).toBe("in");
    expect(judge(cups, { x: cups[0].x, y: cups[0].y - 5 }).result).toBe("rim");
    expect(judge(cups, { x: 5, y: 150 }).result).toBe("miss");
  });

  it("片付けたカップには入らない", () => {
    const taken = cups.map((c) => (c.id === 0 ? { ...c, takenBy: "a" } : c));
    expect(judge(taken, cups[0]).result).not.toBe("in");
  });

  it("入れた人は抜けて、カップが片付き、次の人の番", () => {
    const end = play(setup(), "a", atCup(0));
    expect(end.state.remaining).toEqual(["b", "c"]);
    expect(end.state.cups[0].takenBy).toBe("a");
    expect(beerPong.pendingPlayers(end.state)).toEqual(["b"]);
  });

  it("外れたら次の人。一周したらまた投げる", () => {
    let s = setup();
    s = play(s, "a", MISS).state;
    s = play(s, "b", MISS).state;
    s = play(s, "c", MISS).state;
    expect(beerPong.pendingPlayers(s)).toEqual(["a"]);
    expect(s.throws).toBe(3);
  });

  it("飛んでいる間は誰も操作できない・手番以外は投げられない", () => {
    const step = beerPong.applyAction(setup(), "a", { type: "throw", ...MISS }, even());
    expect(beerPong.pendingPlayers(step.state)).toEqual([]);
    expect(() => beerPong.applyAction(setup(), "b", { type: "throw", ...MISS }, even())).toThrow(
      GameError,
    );
  });

  it("最後の1人が負け", () => {
    let s = setup();
    s = play(s, "a", MISS).state;
    s = play(s, "b", atCup(0)).state;
    const end = play(s, "c", atCup(1));
    expect(end.result?.losers).toEqual(["a"]);
    expect(end.state.exited.map((e) => e.playerId)).toEqual(["b", "c"]);
  });

  it("最後の人が抜けたら、先頭に戻って続ける", () => {
    let s = setup();
    s = play(s, "a", MISS).state;
    s = play(s, "b", MISS).state;
    s = play(s, "c", atCup(0)).state;
    expect(s.remaining).toEqual(["a", "b"]);
    expect(beerPong.pendingPlayers(s)).toEqual(["a"]);
  });

  it("おまかせは残っているカップを狙う", () => {
    const step = beerPong.autoAct(setup(), even());
    expect(step.state.shot?.auto).toBe(true);
    expect(step.state.shot?.result).toBe("in");
  });
});
