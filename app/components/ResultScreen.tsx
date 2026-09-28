import { useEffect, useState } from "react";
import { MAX_NAME_LENGTH } from "~/protocol";
import type { ClientMessage, GameView, RoomView } from "~/protocol";
import { GamePicker } from "./GamePicker";
import { GameScreen } from "./GameScreen";
import { GAMES } from "~/games/registry";
import { Avatar, vibrate, type PlayerMap } from "./ui";

const ROULETTE_MS = 2600;
const DRINK_WARNING = 5;

interface Props {
  room: RoomView;
  game: GameView | null;
  players: PlayerMap;
  deviceId: string;
  isHost: boolean;
  send: (msg: ClientMessage) => void;
  serverNow: () => number;
}

function Roulette({
  candidates,
  chosen,
  players,
}: {
  candidates: string[];
  chosen: string;
  players: PlayerMap;
}) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let elapsed = 0;
    let delay = 60;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      elapsed += delay;
      if (elapsed >= ROULETTE_MS) {
        setIndex(candidates.indexOf(chosen));
        setDone(true);
        return;
      }
      setIndex(i % candidates.length);
      delay *= 1.12;
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [candidates, chosen]);
  const p = players.get(candidates[index]);
  return (
    <div className={`roulette ${done ? "roulette-done" : ""}`}>
      <p className="muted">ルーレットで決定！</p>
      <p className="roulette-name">{p?.name}</p>
    </div>
  );
}

export function ResultScreen(props: Props) {
  // ラウンドごとに状態（ルーレット演出）をリセットする
  return <ResultBody key={props.room.lastResult?.round ?? 0} {...props} />;
}

function ResultBody({ room, game, players, deviceId, isHost, send, serverNow }: Props) {
  const result = room.lastResult;
  const [revealed, setRevealed] = useState(!result?.tieBreak);

  useEffect(() => {
    if (!result?.tieBreak) return;
    const t = setTimeout(() => setRevealed(true), ROULETTE_MS + 400);
    return () => clearTimeout(t);
  }, [result?.tieBreak]);

  useEffect(() => {
    if (revealed) vibrate([80, 60, 200]);
  }, [revealed]);

  if (!result) return null;
  const ranking = room.players.toSorted((a, b) => b.drinks - a.drinks);

  return (
    <div className="result">
      <section className="panel panel-pink loser-panel">
        {result.tieBreak && !revealed ? (
          <Roulette
            candidates={result.tieBreak.candidates}
            chosen={result.tieBreak.chosen}
            players={players}
          />
        ) : (
          <>
            <p className="loser-kicker">ROUND {result.round} の負けは…</p>
            {result.losers.map((id) => {
              const p = players.get(id);
              if (!p) return null;
              const passed = result.passed.includes(id);
              return (
                <div key={id} className="loser">
                  <Avatar character={p.character} size="lg" />
                  <p className="loser-name">{p.name}</p>
                  <p className="loser-penalty">
                    {passed ? "パス権を使った！" : `${room.penalty}！🍺`}
                  </p>
                  {p.deviceId === deviceId && !passed && p.passesLeft > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ink"
                      onClick={() => send({ type: "result.pass", playerId: id })}
                    >
                      パス権を使う（残り{p.passesLeft}）
                    </button>
                  )}
                </div>
              );
            })}
            <p className="loser-reason">{result.reason}</p>
          </>
        )}
      </section>

      <div className="result-actions">
        {isHost ? (
          <button
            type="button"
            className="btn btn-xl btn-green"
            onClick={() => send({ type: "room.start" })}
          >
            もう1回！（{GAMES[room.gameId].name}）
          </button>
        ) : (
          <p className="panel waiting">ホストが次のゲームを選んでいます…</p>
        )}
      </div>

      <section className="picker-section">
        <h3 className="section-title">別のゲームで遊ぶ</h3>
        {isHost && <p className="muted small">選ぶとルール説明の画面に移ります</p>}
        <GamePicker
          current={room.gameId}
          playerCount={room.players.length}
          canPick={isHost}
          onPick={(gameId) => send({ type: "room.game", gameId })}
          layout="grid"
          strictCount
          excludeCurrent
        />
      </section>

      {isHost && (
        <button
          type="button"
          className="btn btn-lg btn-block result-lobby-btn"
          onClick={() => send({ type: "room.lobby" })}
        >
          メンバー・席順を変える
        </button>
      )}

      {!room.players.some((p) => p.deviceId === deviceId) && <JoinNextRound send={send} />}

      <section className="panel">
        <h3 className="panel-title">杯数ランキング</h3>
        <ol className="ranking">
          {ranking.map((p) => (
            <li key={p.id} className="ranking-row">
              <Avatar character={p.character} size="sm" />
              <span className="player-name">{p.name}</span>
              <span className="drinks">🍺 {p.drinks}</span>
              {p.drinks >= DRINK_WARNING && (
                <span className="mini-tag mini-tag-water">💧水を飲もう</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {revealed && game && (
        <details className="panel final-board">
          <summary>最後の盤面を見る</summary>
          <GameScreen
            room={room}
            game={game}
            players={players}
            send={send}
            serverNow={serverNow}
            boardOnly
          />
        </details>
      )}
    </div>
  );
}

function JoinNextRound({ send }: { send: (msg: ClientMessage) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="panel add-player"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        send({ type: "player.add", name });
        setName("");
      }}
    >
      <input
        className="input"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
        placeholder="次のラウンドから参加する"
        aria-label="名前"
      />
      <button type="submit" className="btn btn-green" disabled={!name.trim()}>
        参加
      </button>
    </form>
  );
}
