import type { ReactNode } from "react";
import {
  MARKS,
  scoreOf,
  type HitAndBlowAction,
  type HitAndBlowPlayerView,
  type HitAndBlowTableView,
} from "~/games/hit-and-blow";
import { Avatar, PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<HitAndBlowTableView, HitAndBlowPlayerView, HitAndBlowAction>;

export function Mark({ mark }: { mark: number | null }) {
  if (mark === null) return <span className="hb-mark hb-mark-empty" />;
  return <span className={`hb-mark hb-mark-${mark}`}>{MARKS[mark]}</span>;
}

/** ● と ○ を並べたヒント。どのマスが合っているかは出さない */
export function Pegs({ hits, blows, slots }: { hits: number; blows: number; slots: number }) {
  return (
    <span className="hb-pegs" aria-label={`● ${hits}、○ ${blows}`}>
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          className={`hb-peg ${i < hits ? "hb-hit" : i < hits + blows ? "hb-blow" : ""}`}
        />
      ))}
    </span>
  );
}

/** 予想1回分の縦の列 */
export function GuessColumn({
  head,
  marks,
  foot,
  className = "",
  onSlot,
}: {
  head: ReactNode;
  marks: (number | null)[];
  foot?: ReactNode;
  className?: string;
  onSlot?: (slot: number) => void;
}) {
  return (
    <div className={`hb-col ${className}`}>
      <div className="hb-col-head">{head}</div>
      {marks.map((m, slot) =>
        onSlot && m !== null ? (
          <button
            key={slot}
            type="button"
            className="hb-slot hb-slot-btn"
            onClick={() => onSlot(slot)}
            aria-label={`${slot + 1}番目の ${MARKS[m]} を消す`}
          >
            <Mark mark={m} />
          </button>
        ) : (
          <span key={slot} className="hb-slot">
            <Mark mark={m} />
          </span>
        ),
      )}
      <div className="hb-col-foot">{foot}</div>
    </div>
  );
}

function scrollToEnd(el: HTMLSpanElement | null) {
  const scroller = el?.closest(".hb-scroll");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

export function HitAndBlowUI({ table, view, me, players, act }: Props) {
  const myTurn = !!me && !!view?.isMyTurn;
  const playing = table.phase === "turn";
  const current = table.currentPlayerId ? players.get(table.currentPlayerId) : undefined;
  const last = table.guesses.at(-1);
  const filled = table.draft.every((m) => m !== null);
  const left = table.maxGuesses - table.guesses.length;

  const scoreBadge = (id: string) => {
    const score = table.scores[id];
    const next = id === table.nextPlayerId ? "NEXT" : null;
    const label = [next, score !== null ? `${score}点` : null].filter(Boolean).join(" · ");
    return label || undefined;
  };

  return (
    <div className="game hit-and-blow">
      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={id === table.currentPlayerId || id === table.solvedBy}
            badge={scoreBadge(id)}
          />
        ))}
      </section>

      <section className="turn-banner">
        {playing && (
          <>
            <strong>{current?.name}</strong> の番
            {last && (
              <span className="muted">
                直前：{players.get(last.playerId)?.name} の予想は ●{last.hits} ○{last.blows}
                {last.auto && "（おまかせ）"}
              </span>
            )}
          </>
        )}
        {!playing &&
          (table.solvedBy ? (
            <>
              <strong>{players.get(table.solvedBy)?.name}</strong> が正解！
            </>
          ) : (
            <strong>予想を使い切った！答えは…</strong>
          ))}
      </section>

      <section className={`panel hb-board ${myTurn ? "hand-active" : ""}`}>
        <div className="hb-info">
          <span>
            {MARKS.length}種類から{table.slots}個（同じマークもあり）
          </span>
          <span>残り {left} 回</span>
        </div>

        <div className="hb-scroll">
          <div className="hb-cols">
            {table.guesses.map((g, i) => {
              const owner = players.get(g.playerId);
              return (
                <GuessColumn
                  key={i}
                  className={i === table.guesses.length - 1 ? "hb-col-last" : ""}
                  head={owner ? <Avatar character={owner.character} size="sm" /> : "?"}
                  marks={g.marks}
                  foot={
                    <>
                      <Pegs hits={g.hits} blows={g.blows} slots={table.slots} />
                      <span className="hb-score">{scoreOf(g)}点</span>
                    </>
                  }
                />
              );
            })}
            {playing && (
              <GuessColumn
                className="hb-col-draft"
                head={current ? <Avatar character={current.character} size="sm" /> : "?"}
                marks={table.draft}
                foot={<span className="hb-score">考え中</span>}
                onSlot={myTurn ? (slot) => act({ type: "clear", slot }) : undefined}
              />
            )}
            {table.answer && (
              <GuessColumn
                className="hb-col-answer"
                head={<span className="hb-answer-label">答え</span>}
                marks={table.answer}
              />
            )}
            {/* 列が増えるたびに付け直して、盤を右端（最新）までスクロールする */}
            <span key={table.guesses.length + (table.answer ? 1 : 0)} ref={scrollToEnd} />
          </div>
        </div>

        {myTurn && (
          <div className="hb-input">
            <p className="hb-hint">
              {filled ? "これで良ければ「予想する」" : "マークを上のマスから順に選ぶ"}
            </p>
            <div className="hb-palette">
              {MARKS.map((_, mark) => (
                <button
                  key={mark}
                  type="button"
                  className="hb-pick"
                  disabled={filled}
                  onClick={() => act({ type: "put", mark })}
                  aria-label={`${MARKS[mark]} を置く`}
                >
                  <Mark mark={mark} />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-xl btn-block btn-mint"
              disabled={!filled}
              onClick={() => act({ type: "guess" })}
            >
              予想する
            </button>
          </div>
        )}
        <p className="muted small">
          ● マークも位置も正解　○ マークだけ正解（位置が違う）　点数は ●2点・○1点
        </p>
        <p className="muted small">誰かが当てたとき、一番良かった点数が一番低い人の負け</p>
      </section>
    </div>
  );
}
