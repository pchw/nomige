import { env } from "cloudflare:workers";
import type { GameId } from "~/games/types";
import { generateRoomCode, ROOM_CODE_PATTERN } from "~/protocol";

export function roomStub(code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code));
}

export function normalizeCode(code: string | undefined): string | null {
  const upper = (code ?? "").trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(upper) ? upper : null;
}

export async function createRoom(gameId: GameId): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();
    const res = await roomStub(code).fetch("https://room/init", {
      method: "POST",
      body: JSON.stringify({ code, gameId }),
    });
    if (res.ok) return code;
    if (res.status !== 409) throw new Error(`ルームの作成に失敗しました: ${res.status}`);
  }
  throw new Error("ルームコードの発行に失敗しました");
}

export async function roomInfo(
  code: string,
): Promise<{ exists: false } | { exists: true; gameId: GameId; phase: string }> {
  const res = await roomStub(code).fetch("https://room/info");
  return res.json();
}
