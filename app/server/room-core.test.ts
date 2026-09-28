import { describe, expect, it } from "vitest";
import type { LiarsDiceState } from "~/games/liars-dice";
import {
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
      handleMessage(room, "tablet", { type: "room.config", config: { turnSeconds: 30 } }, 0).error,
    ).toBeDefined();
  });

  it("設定は選択肢にある値だけ受け付ける", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.config", config: { turnSeconds: 999 } }, 0);
    expect(room.config.turnSeconds).toBe(20);
    handleMessage(room, "host", { type: "room.config", config: { turnSeconds: 30 } }, 0);
    expect(room.config.turnSeconds).toBe(30);
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

  it("タイマーは期限が来たときだけ処理する", () => {
    const room = lobby();
    handleMessage(room, "host", { type: "room.start" }, 1000);
    const at = room.game!.timer!.at;
    handleTimer(room, at - 1);
    expect((room.game!.state as LiarsDiceState).bids).toHaveLength(0);
    handleTimer(room, at);
    expect((room.game!.state as LiarsDiceState).bids).toHaveLength(1);
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
