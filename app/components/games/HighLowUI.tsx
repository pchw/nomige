import type {
  Guess,
  HighLowAction,
  HighLowPlayerView,
  HighLowTableView,
  PlayingCard,
  Question,
} from "~/games/high-low";
import { PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<HighLowTableView, HighLowPlayerView, HighLowAction>;

const SUIT_MARK = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;
const RANK_LABEL: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export function Trump({ card, big }: { card: PlayingCard | null; big?: boolean }) {
  if (!card) {
    return <span className={`trump trump-back ${big ? "trump-big" : ""}`}>?</span>;
  }
  const red = card.suit === "H" || card.suit === "D";
  return (
    <span className={`trump ${red ? "trump-red" : ""} ${big ? "trump-big" : ""}`}>
      <span className="trump-rank">{RANK_LABEL[card.rank] ?? card.rank}</span>
      <span className="trump-suit">{SUIT_MARK[card.suit]}</span>
    </span>
  );
}

function cardText(card: PlayingCard) {
  return `${SUIT_MARK[card.suit]}${RANK_LABEL[card.rank] ?? card.rank}`;
}

function questionText(q: Question): string {
  switch (q.kind) {
    case "color":
      return "次のカードは 赤 か 黒 か？";
    case "highLow":
      return `${cardText(q.base)} より 上 か 下 か？`;
    case "inOut":
      return `${q.low} と ${q.high} の 間 か 外 か？`;
    case "suit":
      return "マークはどれ？";
  }
}

const GUESS_LABEL: Record<Guess, string> = {
  red: "赤",
  black: "黒",
  high: "上 ▲",
  low: "下 ▼",
  in: "間",
  out: "外",
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const GUESS_TONE: Partial<Record<Guess, string>> = {
  red: "btn-red",
  black: "btn-ink",
  high: "btn-orange",
  low: "btn-blue",
  in: "btn-green",
  out: "btn-pink",
  H: "btn-red",
  D: "btn-red",
};

export function HighLowUI({ table, view, me, players, act }: Props) {
  const reveal = table.phase !== "guessing" ? table.lastReveal : null;
  const shown = table.table.slice(-4);

  return (
    <div className="game high-low">
      <section className="panel board-cards">
        <p className="stage-label">STAGE {table.stage}</p>
        <div className="trump-row">
          {shown.map((c, i) => (
            <Trump
              key={table.table.length - shown.length + i}
              card={c}
              big={i === shown.length - 1 && !!reveal}
            />
          ))}
          {table.phase === "guessing" && <Trump card={null} big />}
        </div>
        {table.phase === "guessing" ? (
          <p className="question">{questionText(table.question)}</p>
        ) : (
          reveal && (
            <p className="question">
              {reveal.exited.length > 0
                ? `${reveal.exited.map((id) => players.get(id)?.name).join("・")} が降車！`
                : reveal.correct.length === 0
                  ? "全員ハズレ！誰も降りられない"
                  : "全員正解！誰も降りられない"}
            </p>
          )
        )}
      </section>

      <section className="bus">
        <span className="bus-label">🚌 バスに残っている</span>
        <div className="seat-row">
          {table.remaining.map((id) => (
            <PlayerChip
              key={id}
              player={players.get(id)}
              badge={
                reveal
                  ? reveal.wrong.includes(id)
                    ? "✗"
                    : "○"
                  : table.guessedPlayerIds.includes(id)
                    ? "✓"
                    : "…"
              }
            />
          ))}
        </div>
        {table.exited.length > 0 && (
          <div className="seat-row seat-row-dim">
            {table.exited.map((e) => (
              <PlayerChip
                key={e.playerId}
                player={players.get(e.playerId)}
                dim
                badge={`降車 ${e.stage}`}
              />
            ))}
          </div>
        )}
      </section>

      {me && view && table.phase === "guessing" && (
        <section className="panel hand-active">
          {view.inBus ? (
            <>
              <h3 className="panel-title">予想する</h3>
              <div className={`guess-grid guess-grid-${view.options.length}`}>
                {view.options.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`btn btn-xl ${GUESS_TONE[g] ?? ""} ${view.myGuess === g ? "btn-selected" : ""}`}
                    onClick={() => act({ type: "guess", guess: g })}
                  >
                    {GUESS_LABEL[g]}
                  </button>
                ))}
              </div>
              {view.myGuess && <p className="muted">予想済み。全員が選ぶまで変更できます</p>}
            </>
          ) : (
            <p className="safe-banner">セーフ！降車済み。観戦しよう</p>
          )}
        </section>
      )}
    </div>
  );
}
