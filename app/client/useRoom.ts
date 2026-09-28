import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, GameView, RoomView, ServerMessage } from "~/protocol";

export type ConnectionStatus = "connecting" | "open" | "closed";

interface Credentials {
  deviceId: string;
  token: string;
}

function storageKey(code: string) {
  return `nomige:device:${code}`;
}

function loadCredentials(code: string): Credentials | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as Credentials) : null;
  } catch {
    return null;
  }
}

function saveCredentials(code: string, creds: Credentials) {
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(creds));
  } catch {
    // プライベートブラウズなどで保存できない場合は、再接続時に別端末扱いになるだけ
  }
}

export interface RoomConnection {
  status: ConnectionStatus;
  room: RoomView | null;
  game: GameView | null;
  deviceId: string | null;
  error: string | null;
  send: (msg: ClientMessage) => void;
  serverNow: () => number;
}

export function useRoom(code: string): RoomConnection {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<GameView | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const syncTime = (serverTime: number) => {
      offsetRef.current = serverTime - Date.now();
    };

    const connect = () => {
      setStatus("connecting");
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${code}/ws`);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        retry = 0;
        const creds = loadCredentials(code);
        ws.send(JSON.stringify({ type: "hello", ...creds } satisfies ClientMessage));
        pingTimer = setInterval(() => ws.send(JSON.stringify({ type: "ping" })), 25_000);
      });

      ws.addEventListener("message", (e) => {
        const msg = JSON.parse(e.data as string) as ServerMessage;
        switch (msg.type) {
          case "welcome":
            saveCredentials(code, { deviceId: msg.deviceId, token: msg.token });
            setDeviceId(msg.deviceId);
            syncTime(msg.serverTime);
            setStatus("open");
            break;
          case "room":
            syncTime(msg.serverTime);
            setRoom(msg.room);
            break;
          case "game":
            syncTime(msg.serverTime);
            setGame(msg.game);
            break;
          case "error":
            setError(msg.message);
            clearTimeout(errorTimer.current);
            errorTimer.current = setTimeout(() => setError(null), 3500);
            break;
          case "pong":
            syncTime(msg.serverTime);
            break;
          case "event":
            break;
        }
      });

      ws.addEventListener("close", () => {
        clearInterval(pingTimer);
        if (closed) return;
        setStatus("closed");
        retry++;
        reconnectTimer = setTimeout(connect, Math.min(8000, 500 * 2 ** retry));
      });
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [code]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  return { status, room, game, deviceId, error, send, serverNow };
}
