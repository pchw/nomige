import { DurableObject } from "cloudflare:workers";
import { isGameId } from "~/games/registry";
import type { ClientMessage, ServerMessage } from "~/protocol";
import {
  createRoomData,
  gameView,
  handleMessage,
  handleTimer,
  reassignHost,
  roomView,
  type Outcome,
  type RoomData,
} from "./room-core";

const STORAGE_KEY = "room";
const IDLE_TTL_MS = 24 * 60 * 60 * 1000;

interface Attachment {
  deviceId: string | null;
}

/**
 * 1ルーム = 1インスタンス。ゲームロジックは room-core / games の純粋関数に任せ、
 * ここでは WebSocket・永続化・Alarm だけを扱う。
 */
export class Room extends DurableObject<Env> {
  private room: RoomData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>(STORAGE_KEY)) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const { code, gameId } = (await request.json()) as { code: string; gameId: string };
      if (this.room) return new Response("exists", { status: 409 });
      if (!isGameId(gameId)) return new Response("invalid game", { status: 400 });
      this.room = createRoomData(
        code,
        gameId,
        Date.now(),
        crypto.getRandomValues(new Uint32Array(1))[0],
      );
      await this.save();
      return new Response("ok");
    }
    if (url.pathname === "/info") {
      if (!this.room) return Response.json({ exists: false });
      return Response.json({ exists: true, gameId: this.room.gameId, phase: this.room.phase });
    }
    if (request.headers.get("Upgrade") === "websocket") {
      if (!this.room) return new Response("room not found", { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ deviceId: null } satisfies Attachment);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = this.room;
    if (!room || typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const now = Date.now();
    if (msg.type === "ping") {
      this.send(ws, { type: "pong", serverTime: now });
      return;
    }
    if (msg.type === "hello") {
      await this.hello(ws, msg);
      return;
    }
    const { deviceId } = ws.deserializeAttachment() as Attachment;
    if (!deviceId) return;
    const outcome = handleMessage(room, deviceId, msg, now);
    if (outcome.error) {
      this.send(ws, { type: "error", ...outcome.error });
      return;
    }
    await this.commit(outcome);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      // 閉じたソケットを接続中として数えないようにする
      ws.serializeAttachment({ deviceId: null } satisfies Attachment);
      ws.close();
    } catch {
      // すでに閉じている
    }
    if (!this.room) return;
    reassignHost(this.room, this.connectedDeviceIds(ws));
    await this.commit({});
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (room.game?.timer) {
      await this.commit(handleTimer(room, now));
      return;
    }
    if (this.ctx.getWebSockets().length === 0 && now - room.lastActiveAt >= IDLE_TTL_MS) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    await this.scheduleAlarm();
  }

  private async hello(ws: WebSocket, msg: Extract<ClientMessage, { type: "hello" }>) {
    const room = this.room!;
    let device = msg.deviceId ? room.devices[msg.deviceId] : undefined;
    if (!device || device.token !== msg.token) {
      device = { id: crypto.randomUUID(), token: crypto.randomUUID() };
      room.devices[device.id] = device;
    }
    ws.serializeAttachment({ deviceId: device.id } satisfies Attachment);
    reassignHost(room, this.connectedDeviceIds());
    this.send(ws, {
      type: "welcome",
      deviceId: device.id,
      token: device.token,
      serverTime: Date.now(),
    });
    await this.commit({});
  }

  private async commit(outcome: Outcome) {
    await this.save();
    await this.scheduleAlarm();
    for (const event of outcome.events ?? []) this.broadcast({ type: "event", event });
    this.broadcastState();
  }

  private async save() {
    if (this.room) await this.ctx.storage.put(STORAGE_KEY, this.room);
  }

  private async scheduleAlarm() {
    const room = this.room;
    if (!room) return;
    const at = room.game?.timer?.at ?? room.lastActiveAt + IDLE_TTL_MS;
    await this.ctx.storage.setAlarm(at);
  }

  private connectedDeviceIds(exclude?: WebSocket): string[] {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      const { deviceId } = ws.deserializeAttachment() as Attachment;
      if (deviceId) ids.add(deviceId);
    }
    return [...ids];
  }

  private broadcastState() {
    const room = this.room;
    if (!room) return;
    const serverTime = Date.now();
    const view = roomView(room, this.connectedDeviceIds());
    for (const ws of this.ctx.getWebSockets()) {
      const { deviceId } = ws.deserializeAttachment() as Attachment;
      if (!deviceId) continue;
      this.send(ws, { type: "room", room: view, serverTime });
      this.send(ws, { type: "game", game: gameView(room, deviceId), serverTime });
    }
  }

  private broadcast(msg: ServerMessage) {
    for (const ws of this.ctx.getWebSockets()) this.send(ws, msg);
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // 切断済みのソケットは無視する
    }
  }
}
