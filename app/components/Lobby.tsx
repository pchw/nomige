import { useState } from "react";
import { GAME_META } from "~/games/meta";
import { GAMES } from "~/games/registry";
import type { GameId } from "~/games/types";
import { MAX_NAME_LENGTH, MAX_PLAYERS, type ClientMessage, type RoomView } from "~/protocol";
import { GamePicker } from "./GamePicker";
import { RulesView } from "./Rules";
import { Avatar } from "./ui";

interface Props {
  room: RoomView;
  deviceId: string;
  isHost: boolean;
  send: (msg: ClientMessage) => void;
}

/** ロビーに出す詳しいルール（今の設定に合わせた文面） */
export function GameRules({ gameId, config }: { gameId: GameId; config: Record<string, unknown> }) {
  const game = GAMES[gameId];
  const meta = GAME_META[gameId];
  return (
    <section className="panel rules" style={{ "--accent": meta.color } as React.CSSProperties}>
      <h2 className="rules-title">
        <span className="game-emoji">{meta.emoji}</span>
        {game.name} のルール
      </h2>
      <ul className="tags">
        <li>
          {game.minPlayers}〜{game.maxPlayers}人
        </li>
        <li>{meta.duration}</li>
        <li>{meta.style}</li>
      </ul>
      <div className="rules-body">
        <RulesView gameId={gameId} config={config} />
      </div>
    </section>
  );
}

export function Lobby({ room, deviceId, isHost, send }: Props) {
  const [name, setName] = useState("");
  const game = GAMES[room.gameId];
  const count = room.players.length;
  const canStart = count >= game.minPlayers && count <= game.maxPlayers;
  const mine = room.players.filter((p) => p.deviceId === deviceId);

  const move = (index: number, delta: number) => {
    const order = room.players.map((p) => p.id);
    const to = index + delta;
    if (to < 0 || to >= order.length) return;
    [order[index], order[to]] = [order[to], order[index]];
    send({ type: "room.reorder", playerOrder: order });
  };

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    send({ type: "player.add", name });
    setName("");
  };

  return (
    <div className="lobby">
      <section className="picker-section">
        <h3 className="section-title">
          ゲームを選ぶ{!isHost && <small className="muted">（ホストが選べます）</small>}
        </h3>
        <GamePicker
          current={room.gameId}
          playerCount={count}
          canPick={isHost}
          onPick={(gameId) => send({ type: "room.game", gameId })}
          layout="scroll"
          strictCount={false}
        />
      </section>

      <section className="panel">
        <h3 className="panel-title">
          参加者 {count}/{MAX_PLAYERS}
          <small className="muted">（席順に並べてください）</small>
        </h3>
        {count === 0 && <p className="muted">まだ誰もいません。下から参加しましょう</p>}
        <ol className="player-list">
          {room.players.map((p, i) => {
            const editable = p.deviceId === deviceId || isHost;
            return (
              <li
                key={p.id}
                className={`player-row ${p.deviceId === deviceId ? "player-row-mine" : ""}`}
              >
                <span className="seat-no">{i + 1}</span>
                <Avatar character={p.character} />
                <span className="player-name">
                  {p.name}
                  {p.deviceId === deviceId && <span className="mini-tag">この端末</span>}
                  {!p.connected && <span className="mini-tag mini-tag-off">オフライン</span>}
                </span>
                <span className="drinks">🍺{p.drinks}</span>
                <span className="row-actions">
                  <button
                    type="button"
                    className="btn btn-sq btn-sm"
                    onClick={() => move(i, -1)}
                    aria-label="上へ"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sq btn-sm"
                    onClick={() => move(i, 1)}
                    aria-label="下へ"
                  >
                    ↓
                  </button>
                  {editable && (
                    <button
                      type="button"
                      className="btn btn-sq btn-sm btn-red"
                      onClick={() => send({ type: "player.remove", playerId: p.id })}
                      aria-label="削除"
                    >
                      ×
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <form className="add-player" onSubmit={addPlayer}>
          <input
            className="input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder={mine.length === 0 ? "あなたの名前" : "この端末で遊ぶ人を追加"}
            aria-label="名前"
          />
          <button
            type="submit"
            className="btn btn-green"
            disabled={!name.trim() || count >= MAX_PLAYERS}
          >
            参加
          </button>
        </form>
        <p className="muted small">
          タブレット1台で遊ぶときは、この端末に全員の名前を追加してください。
        </p>
      </section>

      <GameRules gameId={room.gameId} config={room.config} />

      <section className="panel">
        <h3 className="panel-title">
          設定{!isHost && <small className="muted">（ホストが変更できます）</small>}
        </h3>
        <div className="config-grid">
          {game.configFields.map((field) => (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              <select
                className="input"
                disabled={!isHost}
                value={String(room.config[field.key])}
                onChange={(e) => {
                  const option = field.options.find((o) => String(o.value) === e.target.value);
                  if (option) send({ type: "room.config", config: { [field.key]: option.value } });
                }}
              >
                {field.options.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="field">
            <span>負けた人は</span>
            <input
              className="input"
              disabled={!isHost}
              defaultValue={room.penalty}
              maxLength={20}
              onBlur={(e) => send({ type: "room.penalty", text: e.target.value })}
            />
          </label>
        </div>
      </section>

      <div className="start-bar">
        {isHost ? (
          <button
            type="button"
            className="btn btn-xl btn-block btn-pink"
            disabled={!canStart}
            onClick={() => send({ type: "room.start" })}
          >
            {canStart
              ? "ゲーム開始！"
              : `あと${Math.max(0, game.minPlayers - count)}人必要（${game.minPlayers}〜${game.maxPlayers}人）`}
          </button>
        ) : (
          <p className="panel waiting">ホストの開始を待っています…</p>
        )}
      </div>
    </div>
  );
}
