import type {
  House,
  WolfAndPigsAction,
  WolfAndPigsPlayerView,
  WolfAndPigsTableView,
  WolfRound,
} from "~/games/wolf-and-pigs";
import { HOUSES } from "~/games/wolf-and-pigs";
import { Countdown, HoldReveal, PlayerChip, type PlayerMap } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<WolfAndPigsTableView, WolfAndPigsPlayerView, WolfAndPigsAction>;

const HOUSE_INFO: Record<House, { name: string; emoji: string; tone: string }> = {
  straw: { name: "わらの家", emoji: "🌾", tone: "house-straw" },
  wood: { name: "木の家", emoji: "🪵", tone: "house-wood" },
  brick: { name: "レンガの家", emoji: "🧱", tone: "house-brick" },
};

function RoundReveal({
  round,
  players,
  latest,
}: {
  round: WolfRound;
  players: PlayerMap;
  latest: boolean;
}) {
  const result =
    round.caught.length === 0
      ? "空き家！狼の空振り"
      : round.caught.length === 1
        ? `${players.get(round.caught[0])?.name} が食べられた！`
        : `${round.caught.length}匹で延長戦！`;
  return (
    <div className={`wolf-round ${latest ? "wolf-round-latest" : ""}`}>
      <p className="stage-label">{round.round === 1 ? "本戦" : `延長戦 ${round.round - 1}`}</p>
      <div className="houses">
        {HOUSES.map((h) => {
          const inside = Object.entries(round.pigPicks)
            .filter(([, v]) => v === h)
            .map(([id]) => id);
          const attacked = round.attacked === h;
          return (
            <div
              key={h}
              className={`house ${HOUSE_INFO[h].tone} ${attacked ? "house-attacked" : ""}`}
            >
              {attacked && <span className="wolf-mark">🐺</span>}
              <span className="house-emoji">{HOUSE_INFO[h].emoji}</span>
              <span className="house-name">{HOUSE_INFO[h].name}</span>
              <span className="house-pigs">
                {inside.map((id) => (
                  <span key={id}>🐷{players.get(id)?.name}</span>
                ))}
                {inside.length === 0 && <span className="muted">空き家</span>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="wolf-result">{result}</p>
    </div>
  );
}

export function WolfAndPigsUI({ room, table, view, me, players, act, serverNow }: Props) {
  const latest = table.history.at(-1);
  // 選択中はこれまでの全ラウンド、公開中は最新以外を「これまで」に出す
  const previous = table.phase === "picking" ? table.history : table.history.slice(0, -1);

  return (
    <div className="game wolf">
      {(table.phase === "roleCheck" || table.phase === "picking") && (
        <section className="panel board-status">
          <p className="stage-label">
            {table.phase === "roleCheck"
              ? "役を確認"
              : table.round === 1
                ? "本戦"
                : `延長戦 ${table.round - 1}`}
          </p>
          {table.phase === "roleCheck" && (
            <p className="big-status">
              🐺 狼はこの中にいる…
              <br />
              <small>
                役を確認した人 {table.checkedCount}/{room.players.length}
              </small>
            </p>
          )}
          {table.phase === "picking" && (
            <>
              <p className="big-status">
                {table.round === 1 ? "🐺 狼はこの中にいる…" : "延長戦！狼はまだ隠れている…"}
              </p>
              {table.round > 1 && (
                <div className="seat-row">
                  {table.pigs.map((id) => (
                    <PlayerChip key={id} player={players.get(id)} badge="🐷" />
                  ))}
                  <span className="chip">＋ 🐺 狼</span>
                </div>
              )}
              <p className="muted">
                選んだ人 {table.pickedCount}/{table.totalPickers}
              </p>
              <Countdown
                deadline={table.deadline}
                total={Number(room.config.pickSeconds)}
                serverNow={serverNow}
              />
            </>
          )}
        </section>
      )}

      {latest && table.phase !== "picking" && table.phase !== "roleCheck" && (
        <section className="panel panel-yellow">
          <RoundReveal round={latest} players={players} latest />
          {table.wolf && (
            <p className="big-status wolf-identity">
              狼の正体は… <PlayerChip player={players.get(table.wolf)} active />
            </p>
          )}
        </section>
      )}

      {me && view && table.phase === "roleCheck" && (
        <section className="panel hand-active">
          <h3 className="panel-title">あなたの役</h3>
          <HoldReveal label="長押しで役を確認">
            <span className={`role-card ${view.role === "wolf" ? "role-wolf" : "role-pig"}`}>
              {view.role === "wolf" ? "🐺 あなたは 狼" : "🐷 あなたは 子豚"}
            </span>
          </HoldReveal>
          <button
            type="button"
            className="btn btn-block btn-green"
            disabled={view.roleChecked}
            onClick={() => act({ type: "checkRole" })}
          >
            {view.roleChecked ? "確認済み" : "確認した"}
          </button>
        </section>
      )}

      {me && view && table.phase === "picking" && view.active && (
        <section className="panel hand-active">
          <h3 className="panel-title">家を選んでください</h3>
          <div className="houses">
            {HOUSES.map((h) => (
              <button
                key={h}
                type="button"
                className={`house house-btn ${HOUSE_INFO[h].tone} ${view.myPick === h ? "house-selected" : ""}`}
                onClick={() => act({ type: "pick", house: h })}
              >
                <span className="house-emoji">{HOUSE_INFO[h].emoji}</span>
                <span className="house-name">{HOUSE_INFO[h].name}</span>
              </button>
            ))}
          </div>
          <HoldReveal label="長押しで役を確認">
            <span className={`role-card ${view.role === "wolf" ? "role-wolf" : "role-pig"}`}>
              {view.role === "wolf" ? "🐺 狼：襲う家を選ぶ" : "🐷 子豚：隠れる家を選ぶ"}
            </span>
          </HoldReveal>
        </section>
      )}

      {me && view && table.phase === "picking" && !view.active && (
        <section className="panel">
          <p className="safe-banner">延長戦を観戦中</p>
          {!view.idled && (
            <button type="button" className="btn btn-block" onClick={() => act({ type: "idle" })}>
              見ています
            </button>
          )}
        </section>
      )}

      {previous.length > 0 && (
        <section className="panel">
          <h3 className="panel-title">これまで</h3>
          {previous.map((r) => (
            <RoundReveal key={r.round} round={r} players={players} latest={false} />
          ))}
        </section>
      )}
    </div>
  );
}
