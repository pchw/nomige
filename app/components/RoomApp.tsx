import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { useRoom } from "~/client/useRoom";
import { GAMES } from "~/games/registry";
import { GameScreen } from "./GameScreen";
import { Lobby } from "./Lobby";
import { ResultScreen } from "./ResultScreen";

function SharePanel({ code, onClose }: { code: string; onClose: () => void }) {
  const url = typeof location === "undefined" ? "" : `${location.origin}/r/${code}`;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    }).then(setQr);
  }, [url]);
  return (
    <section className="panel panel-blue share">
      <div className="share-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="share-body">
        <p className="muted">ルームコード</p>
        <p className="share-code">{code}</p>
        <p className="share-url">{url}</p>
        <div className="share-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? "コピーしました" : "リンクをコピー"}
          </button>
          <button type="button" className="btn btn-sm btn-ink" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </section>
  );
}

export function RoomApp({ code }: { code: string }) {
  const { status, room, game, deviceId, error, send, serverNow } = useRoom(code);
  // null の間は自動：ルームに誰もいなければ招待を最初に見せる
  const [shareOpen, setShowShare] = useState<boolean | null>(null);
  const players = useMemo(
    () => new Map(room?.players.map((p) => [p.id, p]) ?? []),
    [room?.players],
  );

  const isHost = !!room && room.hostDeviceId === deviceId;
  const showShare = shareOpen ?? (room?.phase === "lobby" && room.players.length === 0);

  return (
    <main className="page room-page">
      <header className="room-header">
        <a href="/" className="logo">
          NOMI<span>GE</span>
        </a>
        {room && <span className="room-game">{GAMES[room.gameId].name}</span>}
        <button
          type="button"
          className="btn btn-sm btn-yellow room-code"
          aria-label="招待リンクとQRコードを表示"
          onClick={() => setShowShare(!showShare)}
        >
          {isHost && <span title="ホスト">👑</span>}
          {code}
        </button>
      </header>

      {status !== "open" && (
        <div className="conn-banner">
          {status === "connecting" ? "接続中…" : "再接続しています…"}
        </div>
      )}
      {error && <div className="toast">{error}</div>}

      {showShare && <SharePanel code={code} onClose={() => setShowShare(false)} />}

      {!room || !deviceId ? (
        <div className="panel waiting">読み込み中…</div>
      ) : room.phase === "lobby" ? (
        <Lobby room={room} deviceId={deviceId} isHost={isHost} send={send} />
      ) : room.phase === "playing" && game ? (
        <GameScreen room={room} game={game} players={players} send={send} serverNow={serverNow} />
      ) : room.phase === "result" ? (
        <ResultScreen
          room={room}
          game={game}
          players={players}
          deviceId={deviceId}
          isHost={isHost}
          send={send}
          serverNow={serverNow}
        />
      ) : (
        <div className="panel waiting">読み込み中…</div>
      )}
    </main>
  );
}
