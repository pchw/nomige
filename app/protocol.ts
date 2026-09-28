import type { AnimalId } from "./games/characters";
import type { GameEvent, GameId, PlayerId, TieBreak } from "./games/types";

export type RoomPhase = "lobby" | "playing" | "result";

export type ClientMessage =
  | { type: "hello"; deviceId?: string; token?: string }
  | { type: "player.add"; name: string }
  | { type: "player.rename"; playerId: PlayerId; name: string }
  | { type: "player.remove"; playerId: PlayerId }
  | { type: "room.reorder"; playerOrder: PlayerId[] }
  | { type: "room.game"; gameId: GameId }
  | { type: "room.config"; config: Record<string, unknown> }
  | { type: "room.penalty"; text: string }
  | { type: "room.start" }
  | { type: "room.lobby" }
  | { type: "game.action"; playerId: PlayerId; action: unknown }
  /** 「おまかせで進める」。最後の操作から AUTO_ACT_AFTER_MS 経過後のみ有効 */
  | { type: "game.auto" }
  | { type: "result.pass"; playerId: PlayerId }
  | { type: "ping" };

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  character: AnimalId;
  deviceId: string;
  drinks: number;
  passesLeft: number;
  connected: boolean;
}

export interface ResultView {
  round: number;
  gameId: GameId;
  losers: PlayerId[];
  reason: string;
  tieBreak?: TieBreak;
  passed: PlayerId[];
}

export interface RoomView {
  code: string;
  gameId: GameId;
  config: Record<string, unknown>;
  phase: RoomPhase;
  hostDeviceId: string;
  penalty: string;
  players: PlayerInfo[];
  round: number;
  lastResult: ResultView | null;
}

export interface GameView {
  gameId: GameId;
  round: number;
  version: number;
  table: unknown;
  /** この端末で操作するプレイヤーのビューのみ */
  players: Record<PlayerId, unknown>;
  pending: PlayerId[];
  /** 最後に誰かが操作した時刻（サーバー時刻） */
  lastProgressAt: number;
}

export type ServerMessage =
  | { type: "welcome"; deviceId: string; token: string; serverTime: number }
  | { type: "room"; room: RoomView; serverTime: number }
  | { type: "game"; game: GameView | null; serverTime: number }
  | { type: "event"; event: GameEvent }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; serverTime: number };

export const MAX_PLAYERS = 10;
/** 誰も操作しない状態がこの時間続いたら「おまかせで進める」を出す */
export const AUTO_ACT_AFTER_MS = 30_000;
export const MAX_NAME_LENGTH = 12;
export const PASSES_PER_PLAYER = 1;
export const ROOM_CODE_PATTERN = /^[A-HJ-KM-NP-Z2-9]{6}$/;
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i++)
    code += ROOM_CODE_CHARS[Math.floor(random() * ROOM_CODE_CHARS.length)];
  return code;
}
