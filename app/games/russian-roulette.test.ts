import { describe, expect, it } from "vitest";
import { REVEAL_MS, SHOW_MS, russianRoulette, type RussianRouletteState } from "./russian-roulette";
import { GameError } from "./types";
import { ctxAt } from "./test-helpers";

const players = ["a", "b", "c", "d"];

function setup(overrides: Partial<RussianRouletteState> = {}): RussianRouletteState {
  const { state } = russianRoulette.setup(players, russianRoulette.defaultConfig, ctxAt(0));
  return { ...state, turnIndex: 0, poison: 2, ...overrides };
}

const pick = (s: RussianRouletteState, playerId: string, glass: number) =>
  russianRoulette.applyAction(s, playerId, { type: "pick", glass }, ctxAt(0));

describe("ロシアンルーレット", () => {
  it("グラスは人数分で、ハズレの位置は開示までクライアントに送らない", () => {
    const s = setup();
    expect(s.pickedBy).toHaveLength(4);
    expect(russianRoulette.tableView(s).poison).toBeNull();
    expect(JSON.stringify(russianRoulette.playerView(s, "a"))).not.toContain("poison");
  });

  it("席順に1つずつ選ぶ", () => {
    const step = pick(setup({ turnIndex: 2 }), "c", 0);
    expect(step.state.pickedBy[0]).toBe("c");
    expect(russianRoulette.pendingPlayers(step.state)).toEqual(["d"]);
    expect(russianRoulette.tableView(step.state).nextPlayerId).toBe("a");
  });

  it("手番以外・選ばれたグラス・存在しないグラスは選べない", () => {
    const s = pick(setup(), "a", 0).state;
    expect(() => pick(s, "c", 1)).toThrow(GameError);
    expect(() => pick(s, "b", 0)).toThrow(GameError);
    expect(() => pick(s, "b", 4)).toThrow(GameError);
    expect(() => pick(s, "b", 1.5)).toThrow(GameError);
  });

  it("最後の人には残りが配られ、溜め → 開示 → 少し見せてから結果", () => {
    let s = setup();
    s = pick(s, "a", 3).state;
    s = pick(s, "b", 0).state;
    const step = pick(s, "c", 1);
    expect(step.state.pickedBy).toEqual(["b", "c", "d", "a"]);
    expect(step.state.phase).toBe("reveal");
    expect(step.timer).toEqual({ id: "reveal", at: REVEAL_MS });
    expect(step.result).toBeUndefined();
    expect(russianRoulette.pendingPlayers(step.state)).toEqual([]);
    expect(russianRoulette.tableView(step.state).poison).toBeNull();

    // 結果を返すと結果画面に移るので、開示の時点ではまだ結果を返さない
    const shown = russianRoulette.onTimer(step.state, "reveal", ctxAt(REVEAL_MS));
    expect(shown.state.phase).toBe("shown");
    expect(shown.result).toBeUndefined();
    expect(shown.timer).toEqual({ id: "finish", at: REVEAL_MS + SHOW_MS });
    expect(russianRoulette.tableView(shown.state).poison).toBe(2);

    const end = russianRoulette.onTimer(shown.state, "finish", ctxAt(REVEAL_MS + SHOW_MS));
    expect(end.state.phase).toBe("done");
    expect(end.result?.losers).toEqual(["d"]);
  });

  it("2人なら1人が選んだ時点で決まる", () => {
    const { state } = russianRoulette.setup(["a", "b"], {}, ctxAt(0));
    const first = russianRoulette.pendingPlayers(state)[0];
    const step = pick(state, first, 0);
    expect(step.state.phase).toBe("reveal");
    expect(step.state.pickedBy).not.toContain(null);
  });

  it("おまかせは空いているグラスを選ぶ", () => {
    const s = pick(setup(), "a", 0).state;
    const step = russianRoulette.autoAct(s, ctxAt(0));
    expect(step.state.lastPick?.playerId).toBe("b");
    expect(step.state.lastPick?.auto).toBe(true);
    expect(step.state.lastPick?.glass).not.toBe(0);
  });

  it("ハズレの位置は偏らない", () => {
    const counts = [0, 0, 0, 0];
    for (let seed = 1; seed <= 400; seed++) {
      counts[russianRoulette.setup(players, {}, ctxAt(0, seed)).state.poison]++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(60);
  });
});
