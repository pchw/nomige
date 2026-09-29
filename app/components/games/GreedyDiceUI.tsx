import type {
  GreedyDiceAction,
  GreedyDicePlayerView,
  GreedyDiceTableView,
  Turn,
} from "~/games/greedy-dice";
import { PlayerChip, type PlayerMap } from "../ui";
import { Die } from "./LiarsDiceUI";
import type { GameUIProps } from "./types";

type Props = GameUIProps<GreedyDiceTableView, GreedyDicePlayerView, GreedyDiceAction>;

function LastTurn({ turn, players }: { turn: Turn; players: PlayerMap }) {
  const name = players.get(turn.playerId)?.name;
  return (
    <p className={`greedy-last ${turn.end === "bust" ? "greedy-last-bust" : ""}`}>
      {turn.end === "bust" ? `${name}：1が出て 0点！` : `${name}：${turn.score}点で止めた`}
      {turn.auto && <em>（おまかせ）</em>}
    </p>
  );
}

export function GreedyDiceUI({ table, view, me, players, act }: Props) {
  const current = table.currentPlayerId ? players.get(table.currentPlayerId) : undefined;
  const lastRoll = table.rolls.at(-1);
  // 手番が変わった直後は、前の人がアウトになった出目を残して見せる
  const bustRoll =
    !lastRoll && table.lastTurn?.end === "bust" ? table.lastTurn.rolls.at(-1) : undefined;
  const safe = table.lowest !== null && table.turnTotal > table.lowest;
  const myTurn = !!me && !!view?.isMyTurn;

  return (
    <div className="game greedy-dice">
      {table.phase === "turn" && (
        <section className="turn-banner">
          <PlayerChip player={current} active />
          <span>の番</span>
        </section>
      )}

      <section className={`panel greedy-board ${myTurn ? "hand-active" : ""}`}>
        {table.rolls.length === 0 && table.lastTurn && (
          <LastTurn turn={table.lastTurn} players={players} />
        )}
        <div className="greedy-dice-row" key={table.rolls.length}>
          {lastRoll ? (
            lastRoll.map((f, i) => (
              <span key={i} className="greedy-die">
                <Die face={f} />
              </span>
            ))
          ) : bustRoll ? (
            bustRoll.map((f, i) => (
              <span key={i} className="greedy-die greedy-die-bust">
                <Die face={f} />
              </span>
            ))
          ) : (
            <span className="greedy-ready">🎲 振ってスタート</span>
          )}
        </div>
        <div className="greedy-total">
          {table.turnTotal}
          <small>点</small>
        </div>
        {table.rolls.length > 1 && (
          <p className="muted greedy-history">{table.rolls.map((r) => r.join("+")).join(" → ")}</p>
        )}
        {table.phase === "turn" && table.lowest !== null && (
          <p className={`greedy-target ${safe ? "greedy-target-safe" : ""}`}>
            {safe
              ? `今の最下位（${table.lowest}点）は超えた！止める？`
              : `今の最下位は ${table.lowest}点。これを超えたい`}
          </p>
        )}

        {myTurn && (
          <div className="greedy-actions">
            <button
              type="button"
              className="btn btn-xl btn-orange"
              onClick={() => act({ type: "roll" })}
            >
              振る 🎲
            </button>
            <button
              type="button"
              className="btn btn-xl btn-green"
              disabled={!view!.canStop}
              onClick={() => act({ type: "stop" })}
            >
              止める
              <small>{view!.canStop ? `${table.turnTotal}点で確定` : "まず1回振る"}</small>
            </button>
          </div>
        )}
        <p className="muted small">
          {table.dice === 2 ? "どちらかが 1 なら" : "1 が出たら"} この手番は 0点
        </p>
      </section>

      <section className="panel">
        <h3 className="panel-title">点数（手番順）</h3>
        <ol className="greedy-scores">
          {table.turnOrder.map((id) => {
            const score = table.scores[id];
            const done = score !== undefined;
            const lowest = done && score === table.lowest;
            return (
              <li key={id} className={lowest ? "greedy-score-low" : ""}>
                <PlayerChip
                  player={players.get(id)}
                  active={id === table.currentPlayerId}
                  dim={!done && id !== table.currentPlayerId}
                />
                <span className="greedy-score">
                  {done ? `${score}点` : id === table.currentPlayerId ? "挑戦中" : "…"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
