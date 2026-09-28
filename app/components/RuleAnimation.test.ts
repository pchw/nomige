import { describe, expect, it } from "vitest";
import { GAME_ORDER, GAMES } from "~/games/registry";
import { scenesFor } from "./RuleAnimation";

describe("ルールのアニメーション", () => {
  it("全ゲームに4〜5コマあり、一言は酔っていても読める短さ", () => {
    for (const id of GAME_ORDER) {
      const scenes = scenesFor(id, GAMES[id].defaultConfig);
      expect(scenes.length).toBeGreaterThanOrEqual(4);
      expect(scenes.length).toBeLessThanOrEqual(5);
      for (const s of scenes) expect(s.caption.length).toBeLessThanOrEqual(15);
      // コマの切り替えに使うので一言は重複させない
      expect(new Set(scenes.map((s) => s.caption)).size).toBe(scenes.length);
    }
  });

  it("設定に合わせて絵の内容が変わる", () => {
    expect(scenesFor("hundred-one", { limit: 51 })[2].caption).toContain("51");
    const wild = scenesFor("liars-dice", { onesWild: true })[3].sub;
    const noWild = scenesFor("liars-dice", { onesWild: false })[3].sub;
    expect(wild).toBeDefined();
    expect(noWild).toBeUndefined();
  });
});
