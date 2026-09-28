import { useEffect, useState } from "react";
import {
  isStronger,
  type Face,
  type LiarsDiceAction,
  type LiarsDicePlayerView,
  type LiarsDiceTableView,
} from "~/games/liars-dice";
import { Countdown, PlayerChip, vibrate } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<LiarsDiceTableView, LiarsDicePlayerView, LiarsDiceAction>;

const PIPS: Record<Face, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ face, hit, small }: { face: Face; hit?: boolean; small?: boolean }) {
  return (
    <span className={`die ${hit ? "die-hit" : ""} ${small ? "die-sm" : ""}`} aria-label={`${face}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[face].includes(i) ? "pip" : ""} />
      ))}
    </span>
  );
}

export function LiarsDiceUI({ room, table, view, me, players, act, serverNow }: Props) {
  const last = table.bids.at(-1);
  // 入力中の宣言。宣言が進んだら（bids.length が変わったら）最小の吊り上げに戻す
  const [draft, setDraft] = useState<{ key: number; count: number; face: Face } | null>(null);
  const base = view?.minBid ?? { count: 1, face: 2 as Face };
  const current = draft?.key === table.bids.length ? draft : { key: table.bids.length, ...base };
  const { count, face } = current;
  const setCount = (fn: (c: number) => number) => setDraft({ ...current, count: fn(count) });
  const setFace = (f: Face) => setDraft({ ...current, face: f });

  useEffect(() => {
    if (view?.isMyTurn) vibrate(120);
  }, [view?.isMyTurn]);

  const faces: Face[] = table.onesWild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const valid = isStronger({ count, face }, last);
  const reveal = table.reveal;

  return (
    <div className="game liars-dice">
      <section className="panel board-bid">
        <p className="muted">
          全サイコロ {table.totalDice}個{table.onesWild && "・1はワイルド"}
        </p>
        {last ? (
          <div className="bid-big">
            <PlayerChip player={players.get(last.playerId)} />
            <span className="bid-text">
              <Die face={last.face} /> が <strong>{last.count}</strong>個以上
            </span>
            {last.auto && <em className="muted">（時間切れ）</em>}
          </div>
        ) : (
          <div className="bid-big muted">まだ宣言はありません</div>
        )}
      </section>

      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={table.phase === "bidding" && id === table.currentPlayerId}
            badge={`🎲${table.diceCounts[id]}`}
          />
        ))}
      </section>

      {table.phase === "bidding" && (
        <section className="turn-banner">
          <strong>{players.get(table.currentPlayerId)?.name}</strong> の番
          <Countdown
            deadline={table.deadline}
            total={Number(room.config.turnSeconds)}
            serverNow={serverNow}
          />
        </section>
      )}

      {me && view && table.phase === "bidding" && (
        <section className={`panel ${view.isMyTurn ? "hand-active" : ""}`}>
          <h3 className="panel-title">あなたのサイコロ</h3>
          <div className="dice-row">
            {view.myDice.map((f, i) => (
              <Die key={i} face={f} />
            ))}
          </div>
          {view.hint && (
            <p className="muted hint">
              期待個数：
              {Object.entries(view.hint).map(([f, n]) => (
                <span key={f}>
                  {f}→{n}{" "}
                </span>
              ))}
            </p>
          )}

          {view.isMyTurn && (
            <div className="bid-form">
              <div className="stepper">
                <button
                  type="button"
                  className="btn btn-sq"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                >
                  −
                </button>
                <span className="stepper-value">{count}個</span>
                <button
                  type="button"
                  className="btn btn-sq"
                  onClick={() => setCount((c) => Math.min(table.totalDice, c + 1))}
                >
                  ＋
                </button>
              </div>
              <div className="face-picker">
                {faces.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`face-btn ${face === f ? "face-btn-on" : ""}`}
                    onClick={() => setFace(f)}
                  >
                    <Die face={f} small />
                  </button>
                ))}
              </div>
              <div className="bid-actions">
                <button
                  type="button"
                  className="btn btn-green"
                  disabled={!valid}
                  onClick={() => act({ type: "bid", count, face })}
                >
                  「{face}が{count}個以上」
                </button>
                <button
                  type="button"
                  className="btn btn-red"
                  disabled={!view.canDoubt}
                  onClick={() => act({ type: "doubt" })}
                >
                  ダウト！
                </button>
              </div>
              {!valid && <p className="warn">前の宣言より強くしてください</p>}
            </div>
          )}
        </section>
      )}

      {reveal && (
        <section className="panel panel-yellow reveal">
          <h3 className="panel-title">{players.get(reveal.challenger)?.name} のダウト！</h3>
          <p className="reveal-count">
            <Die face={reveal.bid.face} /> は <strong>{reveal.actual}</strong>個（宣言{" "}
            {reveal.bid.count}個）
          </p>
          <div className="reveal-hands">
            {table.order.map((id) => (
              <div key={id} className="reveal-hand">
                <PlayerChip player={players.get(id)} />
                <div className="dice-row">
                  {reveal.dice[id].map((f, i) => (
                    <Die
                      key={i}
                      face={f}
                      small
                      hit={f === reveal.bid.face || (table.onesWild && f === 1)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {table.bids.length > 1 && (
        <section className="log">
          {table.bids
            .slice(0, -1)
            .slice(-6)
            .toReversed()
            .map((b, i) => (
              <span key={i} className="log-item">
                {players.get(b.playerId)?.name}：<Die face={b.face} small /> ×{b.count}
              </span>
            ))}
        </section>
      )}
    </div>
  );
}
