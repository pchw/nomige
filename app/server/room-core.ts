import { ANIMALS, type AnimalId } from "~/games/characters";
import { createRng } from "~/games/random";
import { GAMES, isGameId, sanitizeConfig } from "~/games/registry";
import {
  GameError,
  type Ctx,
  type GameEvent,
  type GameId,
  type Step,
  type Timer,
} from "~/games/types";
import {
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  PASSES_PER_PLAYER,
  type ClientMessage,
  type GameView,
  type ResultView,
  type RoomPhase,
  type RoomView,
} from "~/protocol";

/** Durable Object に保存するルームの全状態 */
export interface RoomData {
  code: string;
  gameId: GameId;
  config: Record<string, unknown>;
  phase: RoomPhase;
  hostDeviceId: string | null;
  penalty: string;
  devices: Record<string, { id: string; token: string }>;
  players: Record<
    string,
    {
      id: string;
      name: string;
      character: AnimalId;
      deviceId: string;
      drinks: number;
      passesLeft: number;
    }
  >;
  playerOrder: string[];
  round: number;
  game: { version: number; state: unknown; timer: Timer | null } | null;
  lastResult: ResultView | null;
  rngState: number;
  nextPlayerSeq: number;
  lastActiveAt: number;
}

export interface Outcome {
  error?: { code: string; message: string };
  events?: GameEvent[];
}

export function createRoomData(code: string, gameId: GameId, now: number, seed: number): RoomData {
  return {
    code,
    gameId,
    config: { ...GAMES[gameId].defaultConfig },
    phase: "lobby",
    hostDeviceId: null,
    penalty: "1口飲む",
    devices: {},
    players: {},
    playerOrder: [],
    round: 0,
    game: null,
    lastResult: null,
    rngState: seed >>> 0,
    nextPlayerSeq: 1,
    lastActiveAt: now,
  };
}

function withRng<T>(room: RoomData, now: number, fn: (ctx: Ctx) => T): T {
  const rng = createRng(room.rngState);
  try {
    return fn({ now, random: rng.random });
  } finally {
    room.rngState = rng.state();
  }
}

function err(code: string, message: string): Outcome {
  return { error: { code, message } };
}

function isHost(room: RoomData, deviceId: string) {
  return room.hostDeviceId === deviceId;
}

function cleanName(name: unknown): string {
  return typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : "";
}

function applyStep(room: RoomData, step: Step<unknown>): Outcome {
  const game = room.game!;
  game.state = step.state;
  game.version++;
  if (step.timer !== undefined) game.timer = step.timer;
  if (step.result) {
    const { losers, reason, tieBreak } = step.result;
    for (const id of losers) {
      if (room.players[id]) room.players[id].drinks++;
    }
    room.lastResult = {
      round: room.round,
      gameId: room.gameId,
      losers,
      reason,
      tieBreak,
      passed: [],
    };
    room.phase = "result";
    game.timer = null;
  }
  return { events: step.events };
}

function startGame(room: RoomData, now: number): Outcome {
  const def = GAMES[room.gameId];
  const count = room.playerOrder.length;
  if (count < def.minPlayers || count > def.maxPlayers) {
    return err(
      "player_count",
      `${def.name}は${def.minPlayers}〜${def.maxPlayers}人で遊べます（今は${count}人）`,
    );
  }
  room.round++;
  room.phase = "playing";
  room.lastResult = null;
  room.game = { version: 0, state: null, timer: null };
  const step = withRng(room, now, (ctx) => def.setup([...room.playerOrder], room.config, ctx));
  return applyStep(room, step);
}

export function handleMessage(
  room: RoomData,
  deviceId: string,
  msg: ClientMessage,
  now: number,
): Outcome {
  room.lastActiveAt = now;
  const editable = room.phase !== "playing";
  switch (msg.type) {
    case "player.add": {
      if (!editable)
        return err("playing", "ゲーム中は参加できません。次のラウンドから参加できます");
      if (room.playerOrder.length >= MAX_PLAYERS)
        return err("full", `参加できるのは${MAX_PLAYERS}人までです`);
      const name = cleanName(msg.name);
      if (!name) return err("invalid_name", "名前を入力してください");
      const used = new Set(Object.values(room.players).map((p) => p.character));
      const character = ANIMALS.find((a) => !used.has(a)) ?? ANIMALS[0];
      const id = `p${room.nextPlayerSeq++}`;
      room.players[id] = {
        id,
        name,
        character,
        deviceId,
        drinks: 0,
        passesLeft: PASSES_PER_PLAYER,
      };
      room.playerOrder.push(id);
      return {};
    }
    case "player.rename": {
      const p = room.players[msg.playerId];
      if (!p || (p.deviceId !== deviceId && !isHost(room, deviceId)))
        return err("forbidden", "変更できません");
      const name = cleanName(msg.name);
      if (!name) return err("invalid_name", "名前を入力してください");
      p.name = name;
      return {};
    }
    case "player.remove": {
      const p = room.players[msg.playerId];
      if (!p || (p.deviceId !== deviceId && !isHost(room, deviceId)))
        return err("forbidden", "削除できません");
      if (!editable) return err("playing", "ゲーム中は削除できません");
      delete room.players[msg.playerId];
      room.playerOrder = room.playerOrder.filter((id) => id !== msg.playerId);
      return {};
    }
    case "room.reorder": {
      if (!editable) return err("playing", "ゲーム中は席順を変更できません");
      const order = msg.playerOrder;
      const same =
        Array.isArray(order) &&
        order.length === room.playerOrder.length &&
        order.every((id) => room.playerOrder.includes(id));
      if (!same) return err("invalid_order", "席順が不正です");
      room.playerOrder = [...order];
      return {};
    }
    case "room.game": {
      if (!isHost(room, deviceId)) return err("forbidden", "ホストのみ変更できます");
      if (!editable) return err("playing", "ゲーム中は変更できません");
      if (!isGameId(msg.gameId)) return err("invalid_game", "不明なゲームです");
      room.gameId = msg.gameId;
      room.config = { ...GAMES[msg.gameId].defaultConfig };
      room.phase = "lobby";
      room.game = null;
      return {};
    }
    case "room.config": {
      if (!isHost(room, deviceId)) return err("forbidden", "ホストのみ変更できます");
      if (!editable) return err("playing", "ゲーム中は変更できません");
      room.config = sanitizeConfig(GAMES[room.gameId], { ...room.config, ...msg.config });
      return {};
    }
    case "room.penalty": {
      if (!isHost(room, deviceId)) return err("forbidden", "ホストのみ変更できます");
      room.penalty = typeof msg.text === "string" ? msg.text.trim().slice(0, 20) : room.penalty;
      return {};
    }
    case "room.start": {
      if (!isHost(room, deviceId)) return err("forbidden", "ホストのみ開始できます");
      if (!editable) return err("playing", "ゲーム中です");
      return startGame(room, now);
    }
    case "room.lobby": {
      if (!isHost(room, deviceId)) return err("forbidden", "ホストのみ操作できます");
      room.phase = "lobby";
      room.game = null;
      return {};
    }
    case "game.action": {
      if (room.phase !== "playing" || !room.game)
        return err("not_playing", "ゲーム中ではありません");
      const p = room.players[msg.playerId];
      if (!p || p.deviceId !== deviceId) return err("forbidden", "このプレイヤーは操作できません");
      const def = GAMES[room.gameId];
      try {
        const step = withRng(room, now, (ctx) =>
          def.applyAction(room.game!.state, msg.playerId, msg.action, ctx),
        );
        return applyStep(room, step);
      } catch (e) {
        if (e instanceof GameError) return err(e.code, e.message);
        throw e;
      }
    }
    case "result.pass": {
      const p = room.players[msg.playerId];
      const r = room.lastResult;
      if (room.phase !== "result" || !r || !p || p.deviceId !== deviceId)
        return err("forbidden", "パスできません");
      if (!r.losers.includes(p.id) || r.passed.includes(p.id))
        return err("forbidden", "パスできません");
      if (p.passesLeft <= 0) return err("no_pass", "パス権が残っていません");
      p.passesLeft--;
      p.drinks = Math.max(0, p.drinks - 1);
      r.passed.push(p.id);
      return {};
    }
    default:
      return err("unknown", "不明なメッセージです");
  }
}

/** タイマーの期限が来ていれば処理する */
export function handleTimer(room: RoomData, now: number): Outcome {
  const game = room.game;
  if (room.phase !== "playing" || !game?.timer || game.timer.at > now) return {};
  const timer = game.timer;
  game.timer = null;
  const def = GAMES[room.gameId];
  const step = withRng(room, now, (ctx) => def.onTimer(game.state, timer.id, ctx));
  return applyStep(room, step);
}

/** 接続中の端末が変わったとき、ホストが不在なら接続中の端末に引き継ぐ */
export function reassignHost(room: RoomData, connectedDeviceIds: string[]): void {
  if (room.hostDeviceId && connectedDeviceIds.includes(room.hostDeviceId)) return;
  const withPlayers = connectedDeviceIds.find((d) =>
    Object.values(room.players).some((p) => p.deviceId === d),
  );
  room.hostDeviceId = withPlayers ?? connectedDeviceIds[0] ?? room.hostDeviceId;
}

export function roomView(room: RoomData, connectedDeviceIds: string[]): RoomView {
  return {
    code: room.code,
    gameId: room.gameId,
    config: room.config,
    phase: room.phase,
    hostDeviceId: room.hostDeviceId ?? "",
    penalty: room.penalty,
    players: room.playerOrder.map((id) => {
      const p = room.players[id];
      return { ...p, connected: connectedDeviceIds.includes(p.deviceId) };
    }),
    round: room.round,
    lastResult: room.lastResult,
  };
}

export function gameView(room: RoomData, deviceId: string): GameView | null {
  const game = room.game;
  if (!game?.state) return null;
  const def = GAMES[room.gameId];
  const players: Record<string, unknown> = {};
  for (const id of room.playerOrder) {
    if (room.players[id]?.deviceId === deviceId) players[id] = def.playerView(game.state, id);
  }
  return {
    gameId: room.gameId,
    round: room.round,
    version: game.version,
    table: def.tableView(game.state),
    players,
    pending: room.phase === "playing" ? def.pendingPlayers(game.state) : [],
  };
}
