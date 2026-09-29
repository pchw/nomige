import { describe, expect, it } from "vitest";
import { GAME_ORDER, GAMES } from "../registry";
import { rulesFor } from "../rules";

const text = (gameId: Parameters<typeof rulesFor>[0], config: Record<string, unknown>) =>
  JSON.stringify(rulesFor(gameId, config));

describe("詳しいルール", () => {
  it("全ゲームにねらい・流れ・例がある", () => {
    for (const id of GAME_ORDER) {
      const doc = rulesFor(id, GAMES[id].defaultConfig);
      expect(doc.goal.length).toBeGreaterThan(0);
      expect(doc.sections.some((s) => s.steps || s.table)).toBe(true);
      expect(doc.sections.some((s) => s.example)).toBe(true);
    }
  });

  it("101：上限値の設定に合わせてカード表と文面が変わる", () => {
    const normal = rulesFor("hundred-one", { limit: 101 });
    const short = rulesFor("hundred-one", { limit: 51 });
    const cards = (doc: typeof normal) =>
      doc.sections.find((s) => s.title === "カード")!.table!.rows;
    expect(cards(normal).some((r) => r[0] === "+20")).toBe(true);
    expect(cards(short).some((r) => r[0] === "+20")).toBe(false);
    expect(short.goal).toContain("51");
  });

  it("ライアーダイス：ワイルドの ON / OFF で説明と例が変わる", () => {
    expect(text("liars-dice", { onesWild: true })).toContain("今の設定：ON");
    expect(text("liars-dice", { onesWild: false })).toContain("今の設定：OFF");
    expect(text("liars-dice", { onesWild: false })).toContain("Aさんの負け");
  });

  it("ハイロー・被ったらアウト・狼と子豚：設定が文面に出る", () => {
    expect(text("high-low", { stages: "highLowOnly" })).toContain("上か下かのみ");
    expect(text("kabuttara-out", { spoilers: false, strayAnimal: false })).toContain(
      "残り2人になった時点でルーレット",
    );
    expect(text("wolf-and-pigs", { runoffMiss: "retry" })).toContain("やり直し（今の設定）");
  });

  it("欲張りサイコロ・地雷原・グラスすべらせ：設定が文面に出る", () => {
    expect(text("greedy-dice", { dice: 2 })).toContain("今の設定：2個");
    expect(text("minesweeper", { mines: "many" })).toContain("今の設定：多め");
    expect(text("minesweeper", { mines: "normal" })).toContain("6×8");
    expect(text("glass-slide", { wobble: "high" })).toContain("今の設定：大きい");
  });
});
