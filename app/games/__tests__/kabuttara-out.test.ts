import { describe, expect, it } from "vitest";
import type { AnimalId } from "../characters";
import {
  autoAnimalCount,
  findUnique,
  kabuttaraOut,
  type KabuttaraOutState,
} from "../kabuttara-out";
import { GameError } from "../types";
import { ctxAt, fixedCtx } from "./helpers";

const players = ["a", "b", "c", "d"];

function setup(config: Partial<typeof kabuttaraOut.defaultConfig> = {}): KabuttaraOutState {
  const { state } = kabuttaraOut.setup(
    players,
    { ...kabuttaraOut.defaultConfig, ...config },
    ctxAt(0),
  );
  return { ...state, animals: ["cat", "dog", "rabbit", "bear", "fox"] };
}

function pickAll(s: KabuttaraOutState, picks: Record<string, AnimalId>, random = 0.99) {
  let step = { state: s } as ReturnType<typeof kabuttaraOut.applyAction>;
  for (const [p, animal] of Object.entries(picks)) {
    step = kabuttaraOut.applyAction(step.state, p, { type: "pick", animal }, fixedCtx(0, random));
  }
  return step;
}

describe("被ったらアウト", () => {
  it("動物の数は人数+1（4〜10）", () => {
    expect(autoAnimalCount(3)).toBe(4);
    expect(autoAnimalCount(6)).toBe(7);
    expect(autoAnimalCount(10)).toBe(10);
  });

  it("残っていない人（おじゃま役）の選択も数える", () => {
    expect(findUnique(["a", "b"], { a: "cat", b: "dog", c: "dog" })).toEqual(["a"]);
  });

  it("被らなかった人が抜ける", () => {
    const step = pickAll(setup(), { a: "cat", b: "cat", c: "dog", d: "rabbit" });
    expect(step.state.lastReveal?.exited).toEqual(["c", "d"]);
    expect(step.state.remaining).toEqual(["a", "b"]);
  });

  it("残り全員が被らなかったらやり直し", () => {
    const step = pickAll(setup(), { a: "cat", b: "dog", c: "rabbit", d: "bear" });
    expect(step.state.lastReveal?.retry).toBe(true);
    expect(step.state.remaining).toHaveLength(4);
  });

  it("おじゃま役の選択も被り判定に入る", () => {
    let s = pickAll(setup(), { a: "cat", b: "cat", c: "dog", d: "rabbit" }).state;
    s = kabuttaraOut.onTimer(s, "reveal", ctxAt(0)).state;
    expect(kabuttaraOut.playerView(s, "c").role).toBe("spoiler");
    // c(おじゃま) が a と同じネコを選ぶ → a は被り、b は抜ける
    const step = pickAll(s, { a: "cat", b: "dog", c: "cat", d: "bear" });
    expect(step.state.remaining).toEqual(["a"]);
    const end = kabuttaraOut.onTimer(step.state, "reveal", ctxAt(0));
    expect(end.result?.losers).toEqual(["a"]);
  });

  it("おじゃま役は「おじゃましない」を選べ、残っている人は選べない", () => {
    let s = pickAll(setup(), { a: "cat", b: "cat", c: "dog", d: "rabbit" }).state;
    s = kabuttaraOut.onTimer(s, "reveal", ctxAt(0)).state;
    expect(() => kabuttaraOut.applyAction(s, "a", { type: "skip" }, ctxAt(0))).toThrow(GameError);
    s = kabuttaraOut.applyAction(s, "c", { type: "skip" }, ctxAt(0)).state;
    s = kabuttaraOut.applyAction(s, "d", { type: "skip" }, ctxAt(0)).state;
    expect(kabuttaraOut.pendingPlayers(s)).toEqual(["a", "b"]);
    s = kabuttaraOut.applyAction(s, "a", { type: "pick", animal: "cat" }, fixedCtx(0, 0.99)).state;
    const step = kabuttaraOut.applyAction(
      s,
      "b",
      { type: "pick", animal: "dog" },
      fixedCtx(0, 0.99),
    );
    expect(step.state.phase).toBe("revealing");
    expect(step.state.remaining).toHaveLength(2);
    expect(step.state.lastReveal?.retry).toBe(true);
  });

  it("おまかせで、残っている人はランダムな動物、おじゃま役は選ばずに締め切る", () => {
    let s = pickAll(setup(), { a: "cat", b: "cat", c: "dog", d: "rabbit" }).state;
    s = kabuttaraOut.onTimer(s, "reveal", ctxAt(0)).state;
    s = kabuttaraOut.applyAction(s, "a", { type: "pick", animal: "cat" }, ctxAt(0)).state;
    const step = kabuttaraOut.autoAct(s, ctxAt(0));
    expect(step.state.phase).toBe("revealing");
    expect(Object.keys(step.state.lastReveal!.picks).toSorted()).toEqual(["a", "b"]);
  });

  it("おじゃま役なしなら抜けた人は選べない", () => {
    let s = pickAll(setup({ spoilers: false }), {
      a: "cat",
      b: "cat",
      c: "cat",
      d: "rabbit",
    }).state;
    s = kabuttaraOut.onTimer(s, "reveal", ctxAt(0)).state;
    expect(kabuttaraOut.pendingPlayers(s)).toEqual(["a", "b", "c"]);
    expect(() =>
      kabuttaraOut.applyAction(s, "d", { type: "pick", animal: "cat" }, ctxAt(0)),
    ).toThrow(GameError);
  });

  it("おじゃま役なしで残り2人になったらルーレット", () => {
    const s = pickAll(setup({ spoilers: false }), {
      a: "cat",
      b: "cat",
      c: "dog",
      d: "rabbit",
    }).state;
    const step = kabuttaraOut.onTimer(s, "reveal", ctxAt(0));
    expect(step.result?.tieBreak?.candidates).toEqual(["a", "b"]);
  });

  it("残り2人でおじゃま役が誰も選ばず決着しなかったらルーレット", () => {
    let s = pickAll(setup(), { a: "cat", b: "cat", c: "dog", d: "rabbit" }).state;
    // ちょうど2人になった回はルーレットにしない
    s = kabuttaraOut.onTimer(s, "reveal", ctxAt(0)).state;
    expect(s.phase).toBe("picking");
    s = kabuttaraOut.applyAction(s, "c", { type: "skip" }, ctxAt(0)).state;
    s = kabuttaraOut.applyAction(s, "d", { type: "skip" }, ctxAt(0)).state;
    s = pickAll(s, { a: "cat", b: "dog" }).state;
    const step = kabuttaraOut.onTimer(s, "reveal", ctxAt(0));
    expect(step.result?.tieBreak?.candidates).toEqual(["a", "b"]);
    expect(step.result?.reason).toBe("おじゃまが入らずルーレット");
  });

  it("残り2人でもおじゃま役が選んだ回は続ける", () => {
    let s = pickAll(setup(), { a: "cat", b: "cat", c: "dog", d: "rabbit" }).state;
    s = kabuttaraOut.onTimer(s, "reveal", ctxAt(0)).state;
    // おじゃま役が外して決着しなかった
    s = pickAll(s, { a: "cat", b: "dog", c: "fox", d: "bear" }).state;
    expect(s.lastReveal?.retry).toBe(true);
    const step = kabuttaraOut.onTimer(s, "reveal", ctxAt(0));
    expect(step.result).toBeUndefined();
    expect(step.state.phase).toBe("picking");
  });
});
