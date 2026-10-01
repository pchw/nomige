import { describe, expect, it } from "vitest";
import {
  boardSize,
  minesweeper,
  neighbors,
  obviousSafeCells,
  type MinesweeperState,
} from "./minesweeper";
import { GameError } from "./types";
import { ctxAt } from "./test-helpers";

const players = ["a", "b", "c"];

function setup(overrides: Partial<MinesweeperState> = {}): MinesweeperState {
  const { state } = minesweeper.setup(players, minesweeper.defaultConfig, ctxAt(0));
  return { ...state, turnIndex: 0, ...overrides };
}

describe("地雷原", () => {
  it("人数と設定で盤の大きさと地雷の数が決まる", () => {
    expect(boardSize(3, "normal")).toEqual({ cols: 6, rows: 6, mineCount: 8 });
    expect(boardSize(8, "normal")).toEqual({ cols: 6, rows: 8, mineCount: 11 });
    expect(boardSize(3, "few").mineCount).toBeLessThan(boardSize(3, "many").mineCount);
  });

  it("まわりのマスは盤の端で切れる", () => {
    expect(neighbors(0, 6, 6).toSorted((a, b) => a - b)).toEqual([1, 6, 7]);
    expect(neighbors(7, 6, 6)).toHaveLength(8);
  });

  it("1マス目は必ず安全で、地雷はそのあとで決まる", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const step = minesweeper.applyAction(
        setup(),
        "a",
        { type: "open", cell: 14 },
        ctxAt(0, seed),
      );
      expect(step.result).toBeUndefined();
      expect(step.state.mines).toHaveLength(8);
      expect(step.state.mines).not.toContain(14);
    }
  });

  it("開けたマスにはまわりの地雷の数が出て、次の人の番", () => {
    const s = setup({ mines: [1, 6, 35] });
    const step = minesweeper.applyAction(s, "a", { type: "open", cell: 0 }, ctxAt(0));
    expect(step.state.opened[0]).toBe(2);
    expect(step.state.openedBy[0]).toBe("a");
    expect(minesweeper.pendingPlayers(step.state)).toEqual(["b"]);
  });

  it("地雷を開けたら負け。爆発後だけ地雷の位置を見せる", () => {
    const s = setup({ mines: [1, 6, 35] });
    expect(minesweeper.tableView(s).mines).toBeNull();
    const step = minesweeper.applyAction(s, "a", { type: "open", cell: 35 }, ctxAt(0));
    expect(step.result?.losers).toEqual(["a"]);
    expect(step.state.phase).toBe("boom");
    expect(minesweeper.tableView(step.state).mines).toEqual([1, 6, 35]);
  });

  it("開いているマス・手番以外は操作できない", () => {
    const opened = Array(36).fill(null);
    opened[0] = 1;
    const s = setup({ mines: [1], opened });
    expect(() => minesweeper.applyAction(s, "a", { type: "open", cell: 0 }, ctxAt(0))).toThrow(
      GameError,
    );
    expect(() => minesweeper.applyAction(s, "b", { type: "open", cell: 2 }, ctxAt(0))).toThrow(
      GameError,
    );
    expect(() => minesweeper.applyAction(s, "a", { type: "open", cell: 99 }, ctxAt(0))).toThrow(
      GameError,
    );
  });

  it("安全なマスの残りを数える", () => {
    expect(minesweeper.tableView(setup()).safeLeft).toBe(36 - 8);
  });

  it("おまかせは 0 の隣など確実に安全なマスを開ける", () => {
    const opened = Array(36).fill(null);
    opened[0] = 0;
    const s = setup({ mines: [35, 34, 33, 32, 31, 30, 29, 28], opened });
    expect(obviousSafeCells(s).toSorted((a, b) => a - b)).toEqual([1, 6, 7]);
    const step = minesweeper.autoAct(s, ctxAt(0));
    expect(step.result).toBeUndefined();
    expect(step.state.lastOpen?.auto).toBe(true);
    expect([1, 6, 7]).toContain(step.state.lastOpen?.cell);
  });
});
