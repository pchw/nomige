import { describe, expect, it } from "vitest";
import { highLow, isCorrect, type HighLowState, type PlayingCard } from "./high-low";
import { GameError } from "./types";
import { ctxAt } from "./test-helpers";

const players = ["a", "b", "c"];
const card = (rank: number, suit: PlayingCard["suit"] = "S"): PlayingCard => ({ rank, suit });

function setup(deck: PlayingCard[]): HighLowState {
  const { state } = highLow.setup(players, highLow.defaultConfig, ctxAt(0));
  // deck は末尾からめくられる
  return { ...state, deck: deck.toReversed() };
}

function guessAll(s: HighLowState, guesses: Record<string, string>) {
  let step = { state: s } as ReturnType<typeof highLow.applyAction>;
  for (const [p, g] of Object.entries(guesses)) {
    step = highLow.applyAction(step.state, p, { type: "guess", guess: g as never }, ctxAt(0));
  }
  return step;
}

describe("ハイロー", () => {
  it("正誤判定（同じ数字・境界は全員不正解）", () => {
    expect(isCorrect({ kind: "color" }, "red", card(3, "H"))).toBe(true);
    expect(isCorrect({ kind: "highLow", base: card(8) }, "high", card(9))).toBe(true);
    expect(isCorrect({ kind: "highLow", base: card(8) }, "high", card(8))).toBe(false);
    expect(isCorrect({ kind: "highLow", base: card(8) }, "low", card(8))).toBe(false);
    expect(isCorrect({ kind: "inOut", low: 3, high: 9 }, "in", card(5))).toBe(true);
    expect(isCorrect({ kind: "inOut", low: 3, high: 9 }, "out", card(9))).toBe(false);
    expect(isCorrect({ kind: "suit" }, "D", card(2, "D"))).toBe(true);
  });

  it("当てた人が抜け、最後の1人が負け", () => {
    // ステージ1: 赤(H) → a,b 正解で抜ける
    const step = guessAll(setup([card(5, "H")]), { a: "red", b: "red", c: "black" });
    expect(step.state.lastReveal?.exited).toEqual(["a", "b"]);
    expect(step.state.remaining).toEqual(["c"]);
    const end = highLow.onTimer(step.state, "reveal", ctxAt(3000));
    expect(end.result?.losers).toEqual(["c"]);
  });

  it("全員正解・全員不正解なら誰も抜けない", () => {
    const allRight = guessAll(setup([card(5, "H")]), { a: "red", b: "red", c: "red" });
    expect(allRight.state.remaining).toHaveLength(3);
    const allWrong = guessAll(setup([card(5, "H")]), { a: "black", b: "black", c: "black" });
    expect(allWrong.state.remaining).toHaveLength(3);
  });

  it("ライド・ザ・バスの質問順", () => {
    let s = setup([card(5, "H"), card(9, "S"), card(7, "D"), card(1, "C"), card(3, "C")]);
    const kinds: string[] = [];
    for (let i = 0; i < 5; i++) {
      kinds.push(s.question.kind);
      const opts = highLow.playerView(s, "a").options;
      const step = guessAll(s, { a: opts[0], b: opts[0], c: opts[0] });
      s = highLow.onTimer(step.state, "reveal", ctxAt(0)).state;
    }
    expect(kinds).toEqual(["color", "highLow", "inOut", "suit", "highLow"]);
  });

  it("全員が予想するまで締め切らない（時間では進まない）", () => {
    const step = highLow.applyAction(
      setup([card(5, "H")]),
      "a",
      { type: "guess", guess: "red" },
      ctxAt(0),
    );
    expect(step.state.phase).toBe("guessing");
    expect(highLow.onTimer(step.state, "guess", ctxAt(999_999)).state.phase).toBe("guessing");
    expect(highLow.pendingPlayers(step.state)).toEqual(["b", "c"]);
  });

  it("おまかせで未予想の人の分をランダムに予想して締め切る", () => {
    const s = highLow.applyAction(
      setup([card(5, "H")]),
      "a",
      { type: "guess", guess: "red" },
      ctxAt(0),
    ).state;
    const step = highLow.autoAct(s, ctxAt(0));
    expect(step.state.phase).toBe("revealing");
    expect(Object.keys(step.state.lastReveal!.guesses).toSorted()).toEqual(["a", "b", "c"]);
    expect(step.state.lastReveal!.guesses.a).toBe("red");
  });

  it("降りた人は予想できない", () => {
    const step = guessAll(setup([card(5, "H")]), { a: "red", b: "black", c: "black" });
    const next = highLow.onTimer(step.state, "reveal", ctxAt(0)).state;
    expect(() =>
      highLow.applyAction(next, "a", { type: "guess", guess: "high" }, ctxAt(0)),
    ).toThrow(GameError);
  });
});
