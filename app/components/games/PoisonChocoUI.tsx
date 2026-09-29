import { useState, type CSSProperties } from "react";
import {
  biteSize,
  isPoison,
  type PoisonChocoAction,
  type PoisonChocoPlayerView,
  type PoisonChocoTableView,
} from "~/games/poison-choco";
import { PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<PoisonChocoTableView, PoisonChocoPlayerView, PoisonChocoAction>;

interface Cell {
  col: number;
  row: number;
}

export function PoisonChocoUI({ table, view, me, players, act }: Props) {
  // 選択中のマス。誰かがかじったら（残りが変わったら）解除する
  const [selection, setSelection] = useState<(Cell & { key: number }) | null>(null);
  const selected = selection?.key === table.remaining ? selection : null;
  const myTurn = !!me && !!view?.isMyTurn;
  const current = players.get(table.currentPlayerId);
  const onlyPoison = table.remaining === 1;
  const done = table.phase === "poisoned";

  const inBite = (col: number, row: number) =>
    !!selected && col >= selected.col && row >= selected.row;
  const canPick = (col: number, row: number) =>
    myTurn && row < table.heights[col] && (!isPoison(col, row) || onlyPoison);

  const onCell = (col: number, row: number) => {
    if (!canPick(col, row)) return;
    if (selected?.col === col && selected.row === row) act({ type: "eat", col, row });
    else setSelection({ key: table.remaining, col, row });
  };

  // 上の段から描く（row 0 が一番下で、左下が毒）
  const rows = Array.from({ length: table.rows }, (_, i) => table.rows - 1 - i);

  return (
    <div className="game poison-choco">
      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={!done && id === table.currentPlayerId}
            badge={!done && id === table.nextPlayerId ? "NEXT" : undefined}
          />
        ))}
      </section>

      {!done && (
        <section className="turn-banner">
          <strong>{current?.name}</strong> の番
          {table.lastBite && (
            <span className="muted">
              直前：{players.get(table.lastBite.playerId)?.name} が {table.lastBite.eaten}個 食べた
              {table.lastBite.auto && "（おまかせ）"}
            </span>
          )}
        </section>
      )}

      <section className={`panel choco-board ${myTurn ? "hand-active" : ""}`}>
        <p className="choco-info">
          残り <strong>{table.remaining}</strong> かけ
        </p>
        {!done && onlyPoison && <p className="warn">毒しか残っていない！食べるしかない…</p>}
        <div className="choco-grid" style={{ "--cols": table.cols } as CSSProperties}>
          {rows.flatMap((row) =>
            Array.from({ length: table.cols }, (_, col) => {
              const present = row < table.heights[col];
              const poison = isPoison(col, row);
              const cls = [
                "choco-cell",
                present ? "" : "choco-eaten",
                poison ? "choco-poison" : "",
                present && inBite(col, row) ? "choco-bite" : "",
                done && poison ? "choco-poison-eaten" : "",
              ].join(" ");
              return (
                <button
                  key={`${col}-${row}`}
                  type="button"
                  className={cls}
                  disabled={!canPick(col, row)}
                  onClick={() => onCell(col, row)}
                  aria-label={poison ? "毒" : present ? "チョコ" : "食べた跡"}
                >
                  {poison ? "☠️" : ""}
                </button>
              );
            }),
          )}
        </div>
        {myTurn && (
          <div className="choco-actions">
            {!selected ? (
              <p className="muted">
                {onlyPoison ? "☠️ をタップ" : "かじる場所をタップ（そこから右上が全部なくなる）"}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn btn-xl ${onlyPoison ? "btn-red" : "btn-choco"}`}
                  onClick={() => act({ type: "eat", col: selected.col, row: selected.row })}
                >
                  {onlyPoison
                    ? "毒を食べる…☠️"
                    : `ここから ${biteSize(table.heights, selected.col, selected.row)}個 食べる`}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setSelection(null)}>
                  やめる
                </button>
              </>
            )}
          </div>
        )}
        <p className="muted small">☠️ は最後の1かけになるまで食べられない</p>
      </section>
    </div>
  );
}
