import { useEffect, useRef, useState, type ComponentType } from "react";
import { GAMES } from "~/games/registry";
import type { GameId, PlayerId } from "~/games/types";
import type { ClientMessage, GameView, RoomView } from "~/protocol";
import { AmidakujiUI } from "./games/AmidakujiUI";
import { BeerPongUI } from "./games/BeerPongUI";
import { BowlingUI } from "./games/BowlingUI";
import { GlassSlideUI } from "./games/GlassSlideUI";
import { GreedyDiceUI } from "./games/GreedyDiceUI";
import { HighLowUI } from "./games/HighLowUI";
import { HitAndBlowUI } from "./games/HitAndBlowUI";
import { HundredOneUI } from "./games/HundredOneUI";
import { KabuttaraOutUI } from "./games/KabuttaraOutUI";
import { LiarsDiceUI } from "./games/LiarsDiceUI";
import { MinesweeperUI } from "./games/MinesweeperUI";
import { RussianRouletteUI } from "./games/RussianRouletteUI";
import type { GameUIProps } from "./games/types";
import { WolfAndPigsUI } from "./games/WolfAndPigsUI";
import { Avatar, type PlayerMap } from "./ui";
import { WaitBar } from "./WaitBar";

const GAME_UI: Record<GameId, ComponentType<GameUIProps<any, any, any>>> = {
  "hundred-one": HundredOneUI,
  "liars-dice": LiarsDiceUI,
  "high-low": HighLowUI,
  "kabuttara-out": KabuttaraOutUI,
  "wolf-and-pigs": WolfAndPigsUI,
  "greedy-dice": GreedyDiceUI,
  minesweeper: MinesweeperUI,
  "glass-slide": GlassSlideUI,
  bowling: BowlingUI,
  "beer-pong": BeerPongUI,
  "russian-roulette": RussianRouletteUI,
  amidakuji: AmidakujiUI,
  "hit-and-blow": HitAndBlowUI,
};

interface Props {
  room: RoomView;
  game: GameView;
  players: PlayerMap;
  send: (msg: ClientMessage) => void;
  serverNow: () => number;
  /** 結果画面で盤面だけを表示する */
  boardOnly?: boolean;
}

export function GameScreen({ room, game, players, send, serverNow, boardOnly }: Props) {
  const UI = GAME_UI[game.gameId];
  const localIds = room.players.map((p) => p.id).filter((id) => id in game.players);
  const act = (playerId: PlayerId) => (action: unknown) =>
    send({ type: "game.action", playerId, action });

  const common = { room, players, table: game.table, pending: game.pending, serverNow };

  if (boardOnly) {
    return <UI {...common} me={null} view={null} act={() => {}} />;
  }
  const waitBar = (
    <WaitBar game={game} players={players} localIds={localIds} send={send} serverNow={serverNow} />
  );
  if (localIds.length === 0) {
    return (
      <>
        {waitBar}
        <UI {...common} me={null} view={null} act={() => {}} />
      </>
    );
  }
  if (localIds.length === 1) {
    const me = localIds[0];
    return (
      <>
        {waitBar}
        <UI {...common} me={me} view={game.players[me]} act={act(me)} />
      </>
    );
  }
  // 隠し情報のないゲームは目隠しせず、手番の人がそのまま操作する
  if (GAMES[game.gameId].publicBoard) {
    const me = localIds.find((id) => game.pending.includes(id)) ?? null;
    return (
      <>
        {waitBar}
        <UI {...common} me={me} view={me ? game.players[me] : null} act={me ? act(me) : () => {}} />
      </>
    );
  }
  if (GAMES[game.gameId].directHotseat) {
    const pending = localIds.filter((id) => game.pending.includes(id));
    const me = pending[0] ?? null;
    return (
      <>
        {waitBar}
        <TurnCall players={players} pending={pending} />
        {/* 人が替わったら選択中の状態を持ち越さない */}
        <UI
          key={me ?? ""}
          {...common}
          me={me}
          view={me ? game.players[me] : null}
          act={me ? act(me) : () => {}}
        />
      </>
    );
  }
  return (
    <>
      {waitBar}
      <Hotseat
        game={game}
        localIds={localIds}
        players={players}
        UI={UI}
        common={common}
        act={act}
      />
    </>
  );
}

/** 共有端末で、次に選ぶ人を大きく呼び出す */
function TurnCall({ players, pending }: { players: PlayerMap; pending: PlayerId[] }) {
  const next = pending[0] ? players.get(pending[0]) : undefined;
  if (!next) {
    return (
      <section className="panel turn-call turn-call-idle">
        <p className="turn-call-lead">この端末で選ぶ人はいません。待ちましょう</p>
      </section>
    );
  }
  return (
    // 人が替わるたびに出し直して、交代に気づけるようにする
    <section key={next.id} className="panel turn-call">
      <p className="turn-call-name">
        <Avatar character={next.character} size="lg" />
        <span>
          <strong>{next.name}</strong> さんの番
        </span>
      </p>
      <p className="turn-call-lead">他の人は画面を見ないで</p>
      {pending.length > 1 && (
        <p className="turn-call-after">
          このあと：
          {pending
            .slice(1)
            .map((id) => players.get(id)?.name)
            .join("、")}
        </p>
      )}
    </section>
  );
}

/**
 * 1台の端末を複数人で使う場合の目隠し画面。
 * 端末は置いたまま、操作する人だけが「自分です」を押して手元の情報を見る。
 */
function Hotseat({
  game,
  localIds,
  players,
  UI,
  common,
  act,
}: {
  game: GameView;
  localIds: PlayerId[];
  players: PlayerMap;
  UI: ComponentType<GameUIProps<any, any, any>>;
  common: Omit<GameUIProps<unknown, unknown, unknown>, "me" | "view" | "act">;
  act: (playerId: PlayerId) => (action: unknown) => void;
}) {
  const [active, setActive] = useState<PlayerId | null>(null);
  const wasPending = useRef(false);
  const localPending = localIds.filter((id) => game.pending.includes(id));

  // 操作が必要だった人が操作を終えたら自動で目隠しに戻す
  useEffect(() => {
    if (!active) return;
    if (game.pending.includes(active)) wasPending.current = true;
    else if (wasPending.current) setActive(null);
  }, [active, game.pending]);

  const open = (id: PlayerId) => {
    wasPending.current = game.pending.includes(id);
    setActive(id);
  };

  if (active) {
    const player = players.get(active);
    return (
      <>
        <div className="hotseat-bar">
          <span>
            {player && <Avatar character={player.character} size="sm" />} {player?.name} の画面
          </span>
          <button type="button" className="btn btn-sm btn-yellow" onClick={() => setActive(null)}>
            隠す
          </button>
        </div>
        <UI {...common} me={active} view={game.players[active]} act={act(active)} />
      </>
    );
  }

  const next = localPending[0];
  const nextPlayer = next ? players.get(next) : undefined;
  return (
    <>
      <UI {...common} me={null} view={null} act={() => {}} />
      <section className="panel curtain">
        {nextPlayer ? (
          <>
            <p className="curtain-lead">この端末の番です（他の人は見ないで）</p>
            <p className="curtain-name">
              <Avatar character={nextPlayer.character} size="lg" />
              {nextPlayer.name} さん
            </p>
            <button
              type="button"
              className="btn btn-xl btn-block btn-pink"
              onClick={() => open(next)}
            >
              自分です（タップで表示）
            </button>
            {localPending.length > 1 && (
              <p className="muted">
                このあと：
                {localPending
                  .slice(1)
                  .map((id) => players.get(id)?.name)
                  .join("、")}
              </p>
            )}
          </>
        ) : (
          <p className="curtain-lead">この端末で操作する人はいません。待ちましょう</p>
        )}
        <div className="curtain-others">
          <span className="muted">手元を確認：</span>
          {localIds.map((id) => (
            <button key={id} type="button" className="btn btn-sm" onClick={() => open(id)}>
              {players.get(id)?.name}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
