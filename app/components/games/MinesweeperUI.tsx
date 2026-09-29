import { useState, type CSSProperties } from "react";
import type {
  MinesweeperAction,
  MinesweeperPlayerView,
  MinesweeperTableView,
} from "~/games/minesweeper";
import { PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<MinesweeperTableView, MinesweeperPlayerView, MinesweeperAction>;

export function MinesweeperUI({ table, view, me, players, act }: Props) {
  const openedCount = table.opened.filter((v) => v !== null).length;
  // 選択中のマス。誰かが開けたら（開いた数が変わったら）解除する
  const [selection, setSelection] = useState<{ key: number; cell: number } | null>(null);
  const selected = selection?.key === openedCount ? selection.cell : null;
  const myTurn = !!me && !!view?.isMyTurn;
  const current = players.get(table.currentPlayerId);
  const boom = table.phase === "boom";

  const onCell = (cell: number) => {
    if (!myTurn || table.opened[cell] !== null) return;
    // 同じマスをもう一度タップしても開ける
    if (selected === cell) act({ type: "open", cell });
    else setSelection({ key: openedCount, cell });
  };

  return (
    <div className="game minesweeper">
      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={!boom && id === table.currentPlayerId}
            badge={!boom && id === table.nextPlayerId ? "NEXT" : undefined}
          />
        ))}
      </section>

      {!boom && (
        <section className="turn-banner">
          <strong>{current?.name}</strong> の番
          {table.lastOpen && (
            <span className="muted">
              直前：{players.get(table.lastOpen.playerId)?.name} が {table.lastOpen.count} を開けた
              {table.lastOpen.auto && "（おまかせ）"}
            </span>
          )}
        </section>
      )}

      <section className={`panel mine-board ${myTurn ? "hand-active" : ""}`}>
        <div className="mine-info">
          <span>💣 {table.mineCount}個</span>
          <span>安全なマス 残り {table.safeLeft}</span>
        </div>
        {!boom && table.safeLeft === 0 && (
          <p className="warn">もう安全なマスはない！どこを開けても地雷…</p>
        )}
        <div className="mine-grid" style={{ "--cols": table.cols } as CSSProperties}>
          {table.opened.map((count, cell) => {
            const isMine = boom && table.mines?.includes(cell);
            const isBoom = cell === table.boomCell;
            const isLast = !boom && cell === table.lastOpen?.cell;
            const cls = [
              "mine-cell",
              count !== null ? `mine-open mine-n${count}` : "",
              isMine ? "mine-mine" : "",
              isBoom ? "mine-boom" : "",
              isLast ? "mine-last" : "",
              cell === selected ? "mine-selected" : "",
            ].join(" ");
            return (
              <button
                key={cell}
                type="button"
                className={cls}
                disabled={!myTurn || count !== null}
                onClick={() => onCell(cell)}
                aria-label={count !== null ? `${count}` : "未開封"}
              >
                {isBoom ? "💥" : isMine ? "💣" : count === null ? "" : count === 0 ? "・" : count}
              </button>
            );
          })}
        </div>
        {myTurn && (
          <div className="mine-actions">
            {selected === null ? (
              <p className="muted">開けるマスをタップ</p>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-xl btn-purple"
                  onClick={() => act({ type: "open", cell: selected })}
                >
                  このマスを開ける
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setSelection(null)}>
                  やめる
                </button>
              </>
            )}
          </div>
        )}
        <p className="muted small">数字は、まわり8マスにある地雷の数</p>
      </section>
    </div>
  );
}
