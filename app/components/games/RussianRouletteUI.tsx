import type {
  RussianRouletteAction,
  RussianRoulettePlayerView,
  RussianRouletteTableView,
} from "~/games/russian-roulette";
import { Avatar, PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<
  RussianRouletteTableView,
  RussianRoulettePlayerView,
  RussianRouletteAction
>;

export function RussianRouletteUI({ table, view, me, players, act }: Props) {
  const myTurn = !!me && !!view?.isMyTurn;
  const current = table.currentPlayerId ? players.get(table.currentPlayerId) : undefined;
  const poison = table.poison;

  return (
    <div className="game russian-roulette">
      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={id === table.currentPlayerId}
            badge={id === table.nextPlayerId ? "NEXT" : undefined}
          />
        ))}
      </section>

      <section className="turn-banner">
        {table.phase === "pick" && (
          <>
            <strong>{current?.name}</strong> の番
            {table.lastPick && (
              <span className="muted">
                直前：{players.get(table.lastPick.playerId)?.name} が {table.lastPick.glass + 1}{" "}
                番を選んだ
                {table.lastPick.auto && "（おまかせ）"}
              </span>
            )}
          </>
        )}
        {table.phase === "reveal" && <strong>ハズレは…</strong>}
        {poison !== null && (
          <>
            <strong>{players.get(table.pickedBy[poison]!)?.name}</strong> がハズレ！
          </>
        )}
      </section>

      <section
        className={`panel roulette-board ${myTurn ? "hand-active" : ""} ${
          table.phase === "reveal" ? "roulette-drumroll" : ""
        }`}
      >
        <div className="roulette-glasses">
          {table.pickedBy.map((by, glass) => {
            const owner = by ? players.get(by) : undefined;
            const isPoison = glass === poison;
            const cls = [
              "roulette-glass",
              by ? "roulette-taken" : "",
              poison !== null ? (isPoison ? "roulette-poison" : "roulette-safe") : "",
            ].join(" ");
            return (
              <button
                key={glass}
                type="button"
                className={cls}
                disabled={!myTurn || by !== null}
                onClick={() => act({ type: "pick", glass })}
                aria-label={owner ? `${glass + 1}番（${owner.name}）` : `${glass + 1}番`}
              >
                <span className="roulette-no">{glass + 1}</span>
                <span className="roulette-drink">{isPoison ? "💀" : "🥃"}</span>
                <span className="roulette-owner">
                  {owner ? <Avatar character={owner.character} size="sm" /> : "?"}
                </span>
              </button>
            );
          })}
        </div>
        {myTurn && <p className="roulette-hint">グラスをタップして選ぶ</p>}
        <p className="muted small">
          {table.pickedBy.length}個のうち1つだけハズレ。全員が選んだら開示
        </p>
      </section>
    </div>
  );
}
