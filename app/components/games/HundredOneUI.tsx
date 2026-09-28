import { useState } from "react";
import type {
  Card,
  HundredOneAction,
  HundredOnePlayerView,
  HundredOneTableView,
} from "~/games/hundred-one";
import { PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<HundredOneTableView, HundredOnePlayerView, HundredOneAction>;

function cardLabel(card: Card, limit: number): { main: string; sub: string; tone: string } {
  switch (card.kind) {
    case "num":
      return {
        main: `${card.value}`,
        sub: `+${card.value}`,
        tone: card.value >= 10 ? "hot" : "num",
      };
    case "pm10":
      return { main: "±10", sub: "足すか引くか", tone: "pm" };
    case "pass":
      return { main: "パス", sub: "±0", tone: "calm" };
    case "return":
      return { main: "⇄", sub: "リターン", tone: "calm" };
    case "max":
      return { main: `${limit}`, sub: `${limit}にする`, tone: "max" };
  }
}

export function PlayingCardView({
  card,
  limit,
  small,
}: {
  card: Card;
  limit: number;
  small?: boolean;
}) {
  const l = cardLabel(card, limit);
  return (
    <span className={`p-card p-card-${l.tone} ${small ? "p-card-sm" : ""}`}>
      <span className="p-card-main">{l.main}</span>
      <span className="p-card-sub">{l.sub}</span>
    </span>
  );
}

export function HundredOneUI({ table, view, me, players, act }: Props) {
  const [pmChoice, setPmChoice] = useState<string | null>(null);
  // 自分の番が終わったら ±10 の選択は自動で閉じる
  const pmCard = view?.isMyTurn ? pmChoice : null;
  const setPmCard = setPmChoice;
  const endgame = table.total >= table.limit - 20;
  const current = players.get(table.currentPlayerId);

  return (
    <div className="game hundred-one">
      <section className={`panel board-total ${endgame ? "board-total-hot" : ""}`}>
        <div className="total-num">
          {table.total}
          <small> / {table.limit}</small>
        </div>
        <div className="board-row">
          <span className="direction">{table.direction === 1 ? "↻ 時計回り" : "↺ 逆回り"}</span>
          {table.lastPlay && (
            <span className="last-play">
              直前：{players.get(table.lastPlay.playerId)?.name} が
              <PlayingCardView card={table.lastPlay.card} limit={table.limit} small />
              {table.lastPlay.auto && <em>（おまかせ）</em>}
            </span>
          )}
        </div>
      </section>

      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={table.phase === "turn" && id === table.currentPlayerId}
            badge={
              table.phase === "turn" && id === table.nextPlayerId
                ? "NEXT"
                : `${table.handCounts[id]}枚`
            }
          />
        ))}
      </section>

      {table.phase === "turn" && (
        <section className="turn-banner">
          <strong>{current?.name}</strong> の番
        </section>
      )}

      {me && view && table.phase === "turn" && (
        <section className={`panel hand ${view.isMyTurn ? "hand-active" : ""}`}>
          <h3 className="panel-title">
            {view.isMyTurn ? "あなたの番！1枚出す" : view.isNext ? "次はあなた" : "あなたの手札"}
          </h3>
          {view.isMyTurn && view.hand.every((c) => c.wouldBust) && (
            <p className="warn">どれを出してもアウト…覚悟を決めて！</p>
          )}
          <div className="hand-cards">
            {view.hand.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`hand-card ${card.wouldBust ? "hand-card-bust" : ""}`}
                disabled={!view.isMyTurn}
                onClick={() => {
                  if (card.kind === "pm10") setPmCard(card.id);
                  else act({ type: "play", cardId: card.id });
                }}
              >
                <PlayingCardView card={card} limit={table.limit} />
                {card.wouldBust && <span className="bust-tag">アウト</span>}
              </button>
            ))}
          </div>
          {pmCard && (
            <div className="pm-choice">
              <button
                type="button"
                className="btn btn-orange"
                onClick={() => act({ type: "play", cardId: pmCard, sign: 1 })}
              >
                +10
              </button>
              <button
                type="button"
                className="btn btn-blue"
                onClick={() => act({ type: "play", cardId: pmCard, sign: -1 })}
              >
                −10
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPmCard(null)}>
                やめる
              </button>
            </div>
          )}
        </section>
      )}

      {table.revealedHands && (
        <section className="panel">
          <h3 className="panel-title">みんなの手札</h3>
          <div className="reveal-hands">
            {table.order.map((id) => (
              <div key={id} className="reveal-hand">
                <PlayerChip player={players.get(id)} />
                <div className="reveal-hand-cards">
                  {table.revealedHands![id].map((c) => (
                    <PlayingCardView key={c.id} card={c} limit={table.limit} small />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {table.log.length > 0 && (
        <section className="log">
          {table.log
            .slice(-6)
            .toReversed()
            .map((p, i) => (
              <span key={i} className="log-item">
                {players.get(p.playerId)?.name}：
                <PlayingCardView card={p.card} limit={table.limit} small /> → {p.totalAfter}
              </span>
            ))}
        </section>
      )}
    </div>
  );
}
