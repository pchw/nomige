import { describe, expect, it } from "vitest";
import {
  OPEN_MS,
  OPEN_ROWS,
  SHOW_MS,
  TRACE_MS,
  amidakuji,
  loserOf,
  trace,
  type AmidakujiState,
} from "../amidakuji";
import { GameError } from "../types";
import { ctxAt } from "./helpers";

const players = ["a", "b", "c", "d"];

function setup(overrides: Partial<AmidakujiState> = {}, seed = 1): AmidakujiState {
  const { state } = amidakuji.setup(players, amidakuji.defaultConfig, ctxAt(0, seed));
  return { ...state, turnIndex: 0, ...overrides };
}

const act = (
  s: AmidakujiState,
  playerId: string,
  action: Parameters<typeof amidakuji.applyAction>[2],
) => amidakuji.applyAction(s, playerId, action, ctxAt(0));

/** a〜d がそれぞれ 0〜3 番の縦線を選び、横線を1本ずつ引き終えた状態 */
function allLined(s = setup()): AmidakujiState {
  s = act(s, "a", { type: "start", column: 0 }).state;
  s = act(s, "b", { type: "start", column: 1 }).state;
  s = act(s, "c", { type: "start", column: 2 }).state;
  s = act(s, "a", { type: "line", row: 0, gap: 0 }).state;
  s = act(s, "b", { type: "line", row: 1, gap: 1 }).state;
  s = act(s, "c", { type: "line", row: 2, gap: 2 }).state;
  return act(s, "d", { type: "line", row: 3, gap: 0 }).state;
}

describe("あみだくじ", () => {
  it("横線をたどる", () => {
    const rungs = [
      { row: 0, gap: 0, by: null },
      { row: 1, gap: 1, by: null },
    ];
    expect(trace(rungs, 3, 0)).toEqual([0, 1, 2, 2]);
    expect(trace(rungs, 3, 1)).toEqual([1, 0, 0, 0]);
    expect(trace(rungs, 3, 2)).toEqual([2, 2, 1, 1]);
  });

  it("隠れた横線は開くまでクライアントに送らない。ハズレの位置は最初から見える", () => {
    const s = setup();
    const view = amidakuji.tableView(s);
    expect(view.hidden).toBeNull();
    expect(view.loser).toBeNull();
    expect(view.hazure).toBe(s.hazure);
    expect(s.hidden.every((r) => r.row >= OPEN_ROWS)).toBe(true);
    expect(JSON.stringify(amidakuji.playerView(s, "a"))).not.toContain("row");
  });

  it("隠れた横線は同じ段で隣り合わない", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { hidden } = setup({}, seed);
      for (const r of hidden) {
        expect(hidden.some((o) => o.row === r.row && Math.abs(o.gap - r.gap) === 1)).toBe(false);
      }
    }
  });

  it("席順にスタートを選び、最後の人には残りが配られて横線に移る", () => {
    let s = setup({ turnIndex: 2 });
    s = act(s, "c", { type: "start", column: 3 }).state;
    expect(amidakuji.pendingPlayers(s)).toEqual(["d"]);
    s = act(s, "d", { type: "start", column: 0 }).state;
    // 次の a が選ぶと b は残りの1本に決まるので、NEXT は横線の最初の c
    expect(amidakuji.tableView(s).nextPlayerId).toBe("c");
    s = act(s, "a", { type: "start", column: 1 }).state;
    expect(s.startBy).toEqual(["d", "a", "b", "c"]);
    expect(s.phase).toBe("line");
    expect(amidakuji.pendingPlayers(s)).toEqual(["c"]);
  });

  it("手番以外・選ばれた縦線・存在しない縦線は選べない", () => {
    const s = act(setup(), "a", { type: "start", column: 0 }).state;
    expect(() => act(s, "c", { type: "start", column: 1 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "start", column: 0 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "start", column: 4 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "line", row: 0, gap: 0 })).toThrow(GameError);
  });

  it("横線は見えている段だけ。同じ段の隣・同じ場所には引けない", () => {
    let s = setup();
    s = act(s, "a", { type: "start", column: 0 }).state;
    s = act(s, "b", { type: "start", column: 1 }).state;
    s = act(s, "c", { type: "start", column: 2 }).state;
    s = act(s, "a", { type: "line", row: 0, gap: 1 }).state;
    expect(() => act(s, "b", { type: "line", row: 0, gap: 1 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "line", row: 0, gap: 0 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "line", row: 0, gap: 2 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "line", row: OPEN_ROWS, gap: 0 })).toThrow(GameError);
    expect(() => act(s, "b", { type: "line", row: 1, gap: 3 })).toThrow(GameError);
    expect(act(s, "b", { type: "line", row: 1, gap: 1 }).state.added).toHaveLength(2);
  });

  it("全員が引いたら開いて1人ずつたどり、ハズレの人をたどったところで結果", () => {
    let s = setup();
    s = act(s, "a", { type: "start", column: 0 }).state;
    s = act(s, "b", { type: "start", column: 1 }).state;
    s = act(s, "c", { type: "start", column: 2 }).state;
    s = act(s, "a", { type: "line", row: 0, gap: 0 }).state;
    s = act(s, "b", { type: "line", row: 1, gap: 1 }).state;
    s = act(s, "c", { type: "line", row: 2, gap: 2 }).state;
    const step = act(s, "d", { type: "line", row: 3, gap: 0 });
    expect(step.state.phase).toBe("open");
    expect(step.timer).toEqual({ id: "trace", at: OPEN_MS });
    expect(amidakuji.pendingPlayers(step.state)).toEqual([]);
    expect(amidakuji.tableView(step.state).hidden).toEqual(s.hidden);
    expect(amidakuji.tableView(step.state).loser).toBeNull();

    // 席順にたどり、ハズレの人で止まる
    const loser = loserOf(step.state);
    const loserTurn = players.indexOf(loser) + 1;
    s = step.state;
    let now = OPEN_MS;
    for (let i = 1; i <= loserTurn; i++) {
      const t = amidakuji.onTimer(s, "trace", ctxAt(now));
      s = t.state;
      now += TRACE_MS;
      expect(amidakuji.tableView(s).traced).toEqual(players.slice(0, i));
      expect(t.timer).toEqual({ id: i === loserTurn ? "hit" : "trace", at: now });
    }
    const hit = amidakuji.onTimer(s, "hit", ctxAt(now));
    expect(hit.state.phase).toBe("shown");
    expect(hit.result).toBeUndefined();
    expect(amidakuji.tableView(hit.state).loser).toBe(loser);
    const end = amidakuji.onTimer(hit.state, "finish", ctxAt(now + SHOW_MS));
    expect(end.state.phase).toBe("done");
    expect(end.result?.losers).toEqual([loser]);
  });

  it("ハズレにたどり着く人はちょうど1人", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = allLined(setup({}, seed));
      const rungs = [...s.added, ...s.hidden];
      const ends = s.startBy.map((_, c) => trace(rungs, s.openRows + s.hiddenRows, c).at(-1));
      expect(ends.toSorted()).toEqual([0, 1, 2, 3]);
    }
  });

  it("どこを選んでも、どう引いても、負ける確率は偏らない", () => {
    // 全員が同じ縦線・同じ横線を選んでも、隠れた部分で一様に混ざる
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (let seed = 1; seed <= 800; seed++) counts[loserOf(allLined(setup({ hazure: 0 }, seed)))]++;
    for (const c of Object.values(counts)) expect(c).toBeGreaterThan(150);
  });

  it("2人でも遊べる", () => {
    const { state } = amidakuji.setup(["a", "b"], {}, ctxAt(0));
    const first = amidakuji.pendingPlayers(state)[0];
    let s = act(state, first, { type: "start", column: 0 }).state;
    expect(s.phase).toBe("line");
    s = amidakuji.autoAct(s, ctxAt(0)).state;
    s = amidakuji.autoAct(s, ctxAt(0)).state;
    expect(s.phase).toBe("open");
    expect(s.added).toHaveLength(2);
  });

  it("おまかせは空いている縦線・引ける場所を選ぶ", () => {
    let s = act(setup(), "a", { type: "start", column: 0 }).state;
    s = amidakuji.autoAct(s, ctxAt(0)).state;
    expect(s.lastMove).toMatchObject({ kind: "start", playerId: "b", auto: true });
    expect(s.startBy[0]).toBe("a");
    s = amidakuji.autoAct(s, ctxAt(0)).state;
    expect(s.phase).toBe("line");
    for (let i = 0; i < 4; i++) s = amidakuji.autoAct(s, ctxAt(0, i + 1)).state;
    expect(s.phase).toBe("open");
    for (const r of s.added) {
      expect(s.added.some((o) => o.row === r.row && Math.abs(o.gap - r.gap) <= 1 && o !== r)).toBe(
        false,
      );
    }
  });
});
