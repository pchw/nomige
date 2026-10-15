import { describe, expect, it } from "vitest";
import type { PlayingCard } from "./high-low";
import {
  MAX_RUNOFFS,
  NIUNIU,
  NO_NIU,
  SHOW_MS,
  evaluate,
  niuniu,
  pointsLabel,
  type NiuniuState,
} from "./niuniu";
import { GameError } from "./types";
import { ctxAt } from "./test-helpers";

const players = ["a", "b", "c"];

/** ランクだけ指定して手札を作る（マークは適当） */
const cards = (...ranks: number[]): PlayingCard[] =>
  ranks.map((rank, i) => ({ rank, suit: (["S", "H", "D", "C"] as const)[i % 4] }));

/** 各自の手札をランクで指定して始める。最初の人は a */
function setup(ranks: Record<string, number[]>, overrides: Partial<NiuniuState> = {}) {
  const { state } = niuniu.setup(Object.keys(ranks), niuniu.defaultConfig, ctxAt(0));
  const hands = Object.fromEntries(
    Object.entries(ranks).map(([p, r]) => [p, evaluate(cards(...r))]),
  );
  return { ...state, turnIndex: 0, hands, ...overrides };
}

const flip = (s: NiuniuState, playerId: string) =>
  niuniu.applyAction(s, playerId, { type: "flip" }, ctxAt(0));

/** 席順に全員めくる */
function flipAll(s: NiuniuState) {
  let step = { state: s } as ReturnType<typeof flip>;
  for (let i = 0; i < s.order.length; i++) {
    step = flip(step.state, niuniu.pendingPlayers(step.state)[0]);
  }
  return step;
}

describe("ニューニュー", () => {
  it("3枚で10の倍数を作り、残り2枚の合計の下一桁が点数", () => {
    const hand = evaluate(cards(3, 7, 10, 2, 5));
    expect(hand.points).toBe(7);
    expect(hand.triple).toEqual([0, 1, 2]);
    // 6+8=14 → 4
    expect(evaluate(cards(1, 9, 6, 10, 8)).points).toBe(4);
  });

  it("J・Q・K は 10、A は 1 と数える", () => {
    expect(evaluate(cards(11, 12, 13, 1, 4)).points).toBe(5);
    expect(evaluate(cards(1, 13, 9, 3, 3)).points).toBe(6);
  });

  it("残り2枚も10の倍数ならニューニュー、3枚が作れなければウーニュー", () => {
    expect(evaluate(cards(4, 6, 12, 3, 7)).points).toBe(NIUNIU);
    expect(evaluate(cards(13, 11, 12, 10, 10)).points).toBe(NIUNIU);
    const none = evaluate(cards(1, 1, 2, 3, 4));
    expect(none.points).toBe(NO_NIU);
    expect(none.triple).toBeNull();
  });

  it("役名は数字そのまま。ウーニューとニューニューだけ名前で出す", () => {
    expect(pointsLabel(NO_NIU)).toBe("ウーニュー");
    expect(pointsLabel(7)).toBe("7");
    expect(pointsLabel(NIUNIU)).toBe("ニューニュー");
  });

  it("1組のトランプから5枚ずつ、重ならないように配る", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const { state } = niuniu.setup(ids, niuniu.defaultConfig, ctxAt(0, 7));
    const all = ids.flatMap((p) => state.hands[p].cards.map((c) => `${c.suit}${c.rank}`));
    expect(all).toHaveLength(50);
    expect(new Set(all).size).toBe(50);
    for (const p of ids) expect(state.hands[p]).toEqual(evaluate(state.hands[p].cards));
  });

  it("めくるまでは手札をクライアントに送らない", () => {
    const s = setup({ a: [3, 7, 10, 2, 5], b: [1, 1, 2, 3, 4], c: [4, 6, 12, 3, 7] });
    expect(Object.values(niuniu.tableView(s).hands)).toEqual([null, null, null]);
    expect(JSON.stringify(niuniu.playerView(s, "a"))).not.toContain("cards");

    const after = flip(s, "a").state;
    const view = niuniu.tableView(after);
    expect(view.hands.a?.points).toBe(7);
    expect(view.hands.b).toBeNull();
    expect(JSON.stringify(view)).not.toContain('"rank":12');
  });

  it("席順に1人ずつめくる。手番以外は受け付けない", () => {
    const s = setup(
      { a: [3, 7, 10, 2, 5], b: [1, 1, 2, 3, 4], c: [4, 6, 12, 3, 7] },
      {
        turnIndex: 2,
      },
    );
    expect(niuniu.pendingPlayers(s)).toEqual(["c"]);
    expect(niuniu.tableView(s).nextPlayerId).toBe("a");
    expect(() => flip(s, "a")).toThrow(GameError);
    expect(() => niuniu.applyAction(s, "c", { type: "peek" } as never, ctxAt(0))).toThrow(
      GameError,
    );

    const s1 = flip(s, "c").state;
    expect(niuniu.pendingPlayers(s1)).toEqual(["a"]);
    const s2 = flip(s1, "a").state;
    // 最後の人のあとに NEXT はない
    expect(niuniu.tableView(s2).nextPlayerId).toBeNull();
    expect(niuniu.tableView(s2).flipped).toEqual(["c", "a"]);
    // 全員めくるまでは結論を出さない
    expect(niuniu.tableView(s2).verdict).toBeNull();
  });

  it("全員めくったら少し見せてから、一番低い人が負け", () => {
    const s = setup({ a: [3, 7, 10, 2, 5], b: [1, 1, 2, 3, 4], c: [4, 6, 12, 3, 7] });
    const step = flipAll(s);
    expect(step.state.phase).toBe("shown");
    expect(step.result).toBeUndefined();
    expect(step.timer).toEqual({ id: "judge", at: SHOW_MS });
    expect(niuniu.pendingPlayers(step.state)).toEqual([]);
    expect(niuniu.tableView(step.state).verdict).toBe("lose");

    const end = niuniu.onTimer(step.state, "judge", ctxAt(SHOW_MS));
    expect(end.state.phase).toBe("done");
    expect(end.result?.losers).toEqual(["b"]);
    expect(end.result?.reason).toBe("点数が一番低かった（ウーニュー）");
  });

  it("一番低い人が同点なら、その人たちだけで配り直して延長戦", () => {
    const s = setup({ a: [1, 1, 2, 3, 4], b: [3, 7, 10, 2, 5], c: [1, 1, 2, 2, 3] });
    const step = flipAll(s);
    expect(niuniu.tableView(step.state).verdict).toBe("runoff");

    const next = niuniu.onTimer(step.state, "judge", ctxAt(SHOW_MS));
    expect(next.result).toBeUndefined();
    expect(next.timer).toBeNull();
    const r = next.state;
    expect(r.phase).toBe("flip");
    expect(r.runoff).toBe(1);
    expect(r.order).toEqual(["a", "c"]);
    expect(r.flipped).toEqual([]);
    expect(Object.keys(r.hands)).toEqual(["a", "c"]);
    expect(r.safe).toEqual([{ playerId: "b", points: 7, runoff: 0 }]);
    expect(niuniu.pendingPlayers(r)).toHaveLength(1);

    // 延長戦で一番低くなった人が負け
    const fixed = {
      ...r,
      turnIndex: 0,
      hands: { a: evaluate(cards(3, 7, 10, 1, 1)), c: evaluate(cards(3, 7, 10, 4, 5)) },
    };
    const end = niuniu.onTimer(flipAll(fixed).state, "judge", ctxAt(0));
    expect(end.result?.losers).toEqual(["a"]);
    expect(end.result?.reason).toBe("延長戦でも一番低かった（2）");
  });

  it("延長戦を上限までやっても同点ならルーレット", () => {
    const s = setup({ a: [1, 1, 2, 3, 4], b: [1, 1, 2, 2, 3] }, { runoff: MAX_RUNOFFS });
    const step = flipAll(s);
    expect(niuniu.tableView(step.state).verdict).toBe("roulette");
    const end = niuniu.onTimer(step.state, "judge", ctxAt(SHOW_MS));
    expect(end.state.phase).toBe("done");
    expect(end.result?.tieBreak?.candidates).toEqual(["a", "b"]);
    expect(["a", "b"]).toContain(end.result?.losers[0]);
    expect(end.result?.reason).toContain("ルーレット");
  });

  it("一番高い人の同点は関係ない", () => {
    const s = setup({ a: [4, 6, 12, 3, 7], b: [4, 6, 13, 3, 7], c: [3, 7, 10, 2, 5] });
    const end = niuniu.onTimer(flipAll(s).state, "judge", ctxAt(0));
    expect(end.result?.losers).toEqual(["c"]);
  });

  it("おまかせは手番の人の分をめくる", () => {
    const s = setup(
      { a: [3, 7, 10, 2, 5], b: [1, 1, 2, 3, 4], c: [4, 6, 12, 3, 7] },
      {
        turnIndex: 1,
      },
    );
    const step = niuniu.autoAct(s, ctxAt(0));
    expect(step.state.flipped).toEqual(["b"]);
    expect(step.state.lastFlip).toEqual({ playerId: "b", auto: true });
    expect(niuniu.pendingPlayers(step.state)).toEqual(["c"]);
    // 全員めくったあとは何もしない
    const shown = flipAll(s).state;
    expect(niuniu.autoAct(shown, ctxAt(0)).state).toBe(shown);
  });

  it("2人から10人まで遊べる", () => {
    expect(niuniu.minPlayers).toBe(2);
    expect(niuniu.maxPlayers * 5).toBeLessThanOrEqual(52);
    const { state } = niuniu.setup(players, niuniu.defaultConfig, ctxAt(0));
    expect(state.order).toEqual(players);
  });
});
