import { describe, expect, it } from "vitest";
import type { LiarsDiceState } from "~/games/liars-dice";
import { AUTO_ACT_AFTER_MS } from "~/protocol";
import {
  configOf,
  createRoomData,
  gameView,
  handleMessage,
  handleTimer,
  reassignHost,
  roomView,
  type RoomData,
} from "./room-core";

function lobby(): RoomData {
  const room = createRoomData("ABCDEF", "liars-dice", 0, 42);
  reassignHost(room, ["host"]);
  handleMessage(room, "host", { type: "player.add", name: "A" }, 0);
  handleMessage(room, "tablet", { type: "player.add", name: "B" }, 0);
  handleMessage(room, "tablet", { type: "player.add", name: "C" }, 0);
  return room;
}

describe("room-core", () => {
  it("プレイヤーに重複しないキャラを割り当てる", () => {
    const room = lobby();
    const chars = Object.values(room.players).map((p) => p.character);
    expect(new Set(chars).size).toBe(3);
  });

  it("ホスト以外は開始・設定変更できない", () => {
    const room = lobby();
    expect(handleMessage(room, "tablet", { type: "room.start" }, 0).error?.code).toBe("forbidden");
    expect(
      handleMessage(room, "tablet", { type: "room.config", config: { onesWild: false } }, 0).error,
    ).toBeDefined();
  });

  it("設定は選択肢にある値だけ受け付ける", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.config", config: { dicePerPlayer: 99 } }, 0);
    expect(configOf(room).dicePerPlayer).toBe("auto");
    handleMessage(room, "host", { type: "room.config", config: { dicePerPlayer: 3 } }, 0);
    expect(configOf(room).dicePerPlayer).toBe(3);
  });

  it("人数が足りなければ開始できない", () => {
    const room = createRoomData("ABCDEF", "wolf-and-pigs", 0, 1);
    reassignHost(room, ["host"]);
    handleMessage(room, "host", { type: "player.add", name: "A" }, 0);
    expect(handleMessage(room, "host", { type: "room.start" }, 0).error?.code).toBe("player_count");
  });

  it("他の端末のプレイヤーは操作できない", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.start" }, 0);
    const out = handleMessage(
      room,
      "host",
      { type: "game.action", playerId: "p2", action: { type: "doubt" } },
      0,
    );
    expect(out.error?.code).toBe("forbidden");
  });

  it("端末ごとに自分のプレイヤーのビューだけを返す", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.start" }, 0);
    expect(Object.keys(gameView(room, "host")!.players)).toEqual(["p1"]);
    expect(Object.keys(gameView(room, "tablet")!.players)).toEqual(["p2", "p3"]);
    expect(gameView(room, "spectator")!.players).toEqual({});
  });

  it("ラウンドが終わると敗者の杯数が増え、パス権で取り消せる", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.start" }, 0);
    const state = room.game!.state as LiarsDiceState;
    // 手番を p1 に固定し、p1 が宣言 → p2 がダウト
    state.turnIndex = 0;
    handleMessage(
      room,
      "host",
      { type: "game.action", playerId: "p1", action: { type: "bid", count: 15, face: 6 } },
      0,
    );
    handleMessage(
      room,
      "tablet",
      { type: "game.action", playerId: "p2", action: { type: "doubt" } },
      0,
    );
    expect(room.phase).toBe("result");
    expect(room.lastResult?.losers).toEqual(["p1"]);
    expect(room.players.p1.drinks).toBe(1);

    expect(
      handleMessage(room, "tablet", { type: "result.pass", playerId: "p1" }, 0).error,
    ).toBeDefined();
    handleMessage(room, "host", { type: "result.pass", playerId: "p1" }, 0);
    expect(room.players.p1.drinks).toBe(0);
    expect(room.players.p1.passesLeft).toBe(0);
  });

  it("時間では進まず、30秒操作がなければおまかせで進められる", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.start" }, 1000);
    expect(room.game!.timer).toBeNull();
    handleTimer(room, 999_999);
    expect((room.game!.state as LiarsDiceState).bids).toHaveLength(0);

    const early = handleMessage(
      room,
      "tablet",
      { type: "game.auto" },
      1000 + AUTO_ACT_AFTER_MS - 1,
    );
    expect(early.error?.code).toBe("too_early");
    // ホスト以外の端末からも押せる
    handleMessage(room, "tablet", { type: "game.auto" }, 1000 + AUTO_ACT_AFTER_MS);
    expect((room.game!.state as LiarsDiceState).bids).toHaveLength(1);
    // 進んだ直後はまた30秒待つ
    const again = handleMessage(
      room,
      "tablet",
      { type: "game.auto" },
      1000 + AUTO_ACT_AFTER_MS + 1,
    );
    expect(again.error?.code).toBe("too_early");
  });

  it("ゲームを切り替えても、戻るとそのゲームの設定が残っている", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.config", config: { onesWild: false } }, 0);
    handleMessage(room, "host", { type: "room.game", gameId: "high-low" }, 0);
    expect(configOf(room)).toEqual({ stages: "rideTheBus" });
    handleMessage(room, "host", { type: "room.game", gameId: "liars-dice" }, 0);
    expect(configOf(room).onesWild).toBe(false);
  });

  it("結果画面から別のゲームを選ぶとロビーに移る", () => {
    const room = lobby();
    room.phase = "result";
    handleMessage(room, "host", { type: "room.game", gameId: "wolf-and-pigs" }, 0);
    expect(room.phase).toBe("lobby");
    expect(room.gameId).toBe("wolf-and-pigs");
    expect(
      handleMessage(room, "tablet", { type: "room.game", gameId: "high-low" }, 0).error,
    ).toBeDefined();
  });

  it("ゲーム中は参加できず、結果画面では参加できる", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.start" }, 0);
    expect(handleMessage(room, "new", { type: "player.add", name: "D" }, 0).error).toBeDefined();
    room.phase = "result";
    expect(handleMessage(room, "new", { type: "player.add", name: "D" }, 0).error).toBeUndefined();
  });

  it("ホストが切断したらプレイヤーのいる端末に引き継ぐ", () => {
    const room = lobby();
    reassignHost(room, ["spectator", "tablet"]);
    expect(room.hostDeviceId).toBe("tablet");
    expect(roomView(room, ["tablet"]).players.find((p) => p.id === "p1")?.connected).toBe(false);
  });
});
