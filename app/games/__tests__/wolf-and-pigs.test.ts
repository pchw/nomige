import { describe, expect, it } from "vitest";
import { wolfAndPigs, type House, type WolfAndPigsState } from "../wolf-and-pigs";
import { ctxAt } from "./helpers";

const players = ["a", "b", "c", "d", "w"];

function picking(config: Partial<typeof wolfAndPigs.defaultConfig> = {}): WolfAndPigsState {
  const { state } = wolfAndPigs.setup(
    players,
    { ...wolfAndPigs.defaultConfig, ...config },
    ctxAt(0),
  );
  const s: WolfAndPigsState = { ...state, wolf: "w", pigs: ["a", "b", "c", "d"] };
  let step = { state: s } as ReturnType<typeof wolfAndPigs.applyAction>;
  for (const p of players) {
    step = wolfAndPigs.applyAction(step.state, p, { type: "checkRole" }, ctxAt(0));
  }
  return step.state;
}

function pickAll(s: WolfAndPigsState, picks: Record<string, House>) {
  let step = { state: s } as ReturnType<typeof wolfAndPigs.applyAction>;
  for (const [p, house] of Object.entries(picks)) {
    step = wolfAndPigs.applyAction(step.state, p, { type: "pick", house }, ctxAt(0));
  }
  return wolfAndPigs.onTimer(step.state, "reveal", ctxAt(0));
}

describe("狼と子豚", () => {
  it("全員が役を確認したら選択フェーズ", () => {
    expect(picking().phase).toBe("picking");
  });

  it("狼の家に1匹だけならその子豚の負け", () => {
    const step = pickAll(picking(), { a: "straw", b: "wood", c: "wood", d: "brick", w: "straw" });
    expect(step.result?.losers).toEqual(["a"]);
  });

  it("空き家なら狼の負け", () => {
    const step = pickAll(picking(), { a: "wood", b: "wood", c: "wood", d: "brick", w: "straw" });
    expect(step.result?.losers).toEqual(["w"]);
  });

  it("2匹以上なら捕まった子豚で延長戦、狼は同じ", () => {
    const step = pickAll(picking(), { a: "wood", b: "wood", c: "straw", d: "brick", w: "wood" });
    expect(step.result).toBeUndefined();
    expect(step.state.round).toBe(2);
    expect(step.state.pigs).toEqual(["a", "b"]);
    expect(step.state.wolf).toBe("w");
    expect(wolfAndPigs.playerView(step.state, "c")).toMatchObject({ role: "pig", active: false });
  });

  it("延長戦の空振り：設定で狼の負け／やり直し", () => {
    const first = { a: "wood", b: "wood", c: "straw", d: "brick", w: "wood" } as const;
    const runoff = pickAll(picking(), first).state;
    const miss = pickAll(runoff, { a: "straw", b: "straw", w: "brick" });
    expect(miss.result?.losers).toEqual(["w"]);

    const retryRunoff = pickAll(picking({ runoffMiss: "retry" }), first).state;
    const retry = pickAll(retryRunoff, { a: "straw", b: "straw", w: "brick" });
    expect(retry.result).toBeUndefined();
    expect(retry.state.pigs).toEqual(["a", "b"]);
    expect(retry.state.round).toBe(3);
  });

  it("狼の正体は終了まで公開しない", () => {
    const s = picking();
    expect(wolfAndPigs.tableView(s).wolf).toBeUndefined();
    const end = pickAll(s, { a: "straw", b: "wood", c: "wood", d: "brick", w: "straw" });
    expect(wolfAndPigs.tableView(end.state).wolf).toBe("w");
  });

  it("延長戦では対象外の人も「見ています」を押すまで pending に含める", () => {
    const runoff = pickAll(picking(), {
      a: "wood",
      b: "wood",
      c: "straw",
      d: "brick",
      w: "wood",
    }).state;
    expect(wolfAndPigs.pendingPlayers(runoff)).toEqual(players);
    const idled = wolfAndPigs.applyAction(runoff, "c", { type: "idle" }, ctxAt(0)).state;
    expect(wolfAndPigs.pendingPlayers(idled)).not.toContain("c");
  });

  it("未選択者は時間切れでランダムな家に入る", () => {
    const step = wolfAndPigs.onTimer(picking(), "pick", ctxAt(0));
    expect(Object.keys(step.state.history[0].pigPicks)).toEqual(["a", "b", "c", "d"]);
  });
});
