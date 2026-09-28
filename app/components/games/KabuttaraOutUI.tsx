import { CHARACTERS } from "~/games/characters";
import type {
  KabuttaraOutAction,
  KabuttaraOutPlayerView,
  KabuttaraOutTableView,
} from "~/games/kabuttara-out";
import { PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<KabuttaraOutTableView, KabuttaraOutPlayerView, KabuttaraOutAction>;

export function KabuttaraOutUI({ table, view, me, players, act }: Props) {
  const reveal = table.phase !== "picking" ? table.lastReveal : null;

  return (
    <div className="game kabuttara">
      <section className="panel board-status">
        <p className="stage-label">{table.round}回目</p>
        <div className="seat-row">
          {table.remaining.map((id) => (
            <PlayerChip
              key={id}
              player={players.get(id)}
              active={reveal ? reveal.collided.includes(id) : false}
              badge={
                table.phase === "picking"
                  ? table.pickedPlayerIds.includes(id)
                    ? "✓"
                    : "…"
                  : undefined
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
                badge={table.spoilers ? "おじゃま" : "セーフ"}
              />
            ))}
          </div>
        )}
      </section>

      {reveal && (
        <section className="panel panel-yellow">
          <h3 className="panel-title">
            {reveal.retry
              ? "全員バラバラ！やり直し"
              : reveal.exited.length > 0
                ? `${reveal.exited.map((id) => players.get(id)?.name).join("・")} セーフ！`
                : "全員被り！"}
          </h3>
          <div className="animal-grid">
            {table.animals.map((a) => {
              const pickers = Object.entries(reveal.picks)
                .filter(([, v]) => v === a)
                .map(([id]) => id);
              const stray = reveal.stray === a;
              const count = pickers.length + (stray ? 1 : 0);
              return (
                <div key={a} className={`animal-cell ${count >= 2 ? "animal-cell-hit" : ""}`}>
                  <span className="animal-emoji" style={{ background: CHARACTERS[a].color }}>
                    {CHARACTERS[a].emoji}
                  </span>
                  <span className="animal-pickers">
                    {pickers.map((id) => (
                      <span
                        key={id}
                        className={
                          table.remaining.includes(id) || reveal.exited.includes(id) ? "" : "muted"
                        }
                      >
                        {players.get(id)?.name}
                      </span>
                    ))}
                    {stray && <span className="stray">のら</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {me && view && table.phase === "picking" && view.role !== "watching" && (
        <section className="panel hand-active">
          <h3 className="panel-title">
            {view.role === "remaining"
              ? "被らない動物を選べ！"
              : "おじゃま役：残っている人に被せろ！"}
          </h3>
          <div className="animal-grid">
            {table.animals.map((a) => (
              <button
                key={a}
                type="button"
                className={`animal-cell animal-btn ${view.myPick === a ? "animal-btn-on" : ""}`}
                onClick={() => act({ type: "pick", animal: a })}
              >
                <span className="animal-emoji" style={{ background: CHARACTERS[a].color }}>
                  {CHARACTERS[a].emoji}
                </span>
                <span className="animal-name">{CHARACTERS[a].name}</span>
              </button>
            ))}
          </div>
          {view.role === "spoiler" && (
            <button
              type="button"
              className={`btn btn-block skip-btn ${view.skipped ? "btn-selected" : ""}`}
              onClick={() => act({ type: "skip" })}
            >
              {view.skipped ? "今回はおじゃましない（選択済み）" : "今回はおじゃましない"}
            </button>
          )}
        </section>
      )}
      {me && view?.role === "watching" && table.phase === "picking" && (
        <p className="safe-banner">セーフ！観戦しよう</p>
      )}
    </div>
  );
}
