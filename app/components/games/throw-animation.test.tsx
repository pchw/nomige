import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { beerPong } from "~/games/beer-pong";
import { bowling } from "~/games/bowling";
import { glassSlide } from "~/games/glass-slide";
import { frameAt } from "~/games/physics";
import type { PlayerInfo } from "~/protocol";
import { BeerPongUI } from "./BeerPongUI";
import { BowlingUI } from "./BowlingUI";
import { GlassSlideUI } from "./GlassSlideUI";

const ids = ["a", "b", "c"];
const players = new Map(
  ids.map((id) => [id, { id, name: id, character: "cat" } as unknown as PlayerInfo]),
);
const ctx = (now: number) => ({ now, random: () => 0.5 });
const THROWN_AT = 10_000;

/** 投げた直後の状態を、サーバーより少し遅れた時計の端末で描く */
function renderJustThrown(UI: any, def: any, action: unknown, clockLag: number) {
  const { state } = def.setup(ids, def.defaultConfig, ctx(0));
  const player = def.pendingPlayers(state)[0];
  const thrown = def.applyAction(state, player, action, ctx(THROWN_AT)).state;
  return renderToString(
    <UI
      room={{} as any}
      players={players}
      table={def.tableView(thrown)}
      me={player}
      view={def.playerView(thrown, player)}
      pending={[]}
      act={() => {}}
      serverNow={() => THROWN_AT - clockLag}
    />,
  );
}

describe("投げた直後のアニメーション", () => {
  it("ボウリングの結果画面では、負けた人の倒れたピンを横倒しで描く", () => {
    const { state } = bowling.setup(ids, bowling.defaultConfig, ctx(0));
    // 全員が真ん中にまっすぐ投げる（同じ本数なら延長戦を繰り返し、最後はルーレットで決着）
    let s = state;
    while (s.phase !== "done") {
      const p = bowling.pendingPlayers(s)[0];
      const step = bowling.applyAction(s, p, { type: "roll", x: 30, angle: 0, power: 60 }, ctx(0));
      s = bowling.onTimer(step.state, "settle", ctx(step.timer!.at)).state;
    }
    const table = bowling.tableView(s);
    const html = renderToString(
      <BowlingUI
        room={{} as any}
        players={players}
        table={table}
        me={null}
        view={null}
        pending={[]}
        act={() => {}}
        serverNow={() => 0}
      />,
    );
    const lying = html.match(/bowling-pin-lying/g)?.length ?? 0;
    expect(table.loserBoard!.knocked.length).toBeGreaterThan(0);
    expect(lying).toBe(table.loserBoard!.knocked.length);
  });

  it("軌跡のコマは、開始前でも終了後でも必ず返る", () => {
    const frames = [[0], [1], [2]];
    expect(frameAt(frames, -50)).toEqual([0]);
    expect(frameAt(frames, 99_999)).toEqual([2]);
  });

  it("端末の時計が遅れていても描画で落ちない", () => {
    for (const lag of [0, 40, 2000]) {
      expect(() =>
        renderJustThrown(BowlingUI, bowling, { type: "roll", x: 30, angle: 0, power: 60 }, lag),
      ).not.toThrow();
      expect(() =>
        renderJustThrown(GlassSlideUI, glassSlide, { type: "slide", x: 50, power: 60 }, lag),
      ).not.toThrow();
      expect(() =>
        renderJustThrown(BeerPongUI, beerPong, { type: "throw", angle: 0, power: 60 }, lag),
      ).not.toThrow();
    }
  });
});
