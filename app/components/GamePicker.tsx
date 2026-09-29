import { useEffect, useRef } from "react";
import { GAME_META } from "~/games/meta";
import { GAME_ORDER, GAMES } from "~/games/registry";
import type { GameId } from "~/games/types";
import { RulesButton } from "./Rules";

/** ゲームカードの中身（トップ・ロビー・結果画面で共通） */
export function GameCardBody({ id }: { id: GameId }) {
  const game = GAMES[id];
  const info = GAME_META[id];
  return (
    <>
      <span className="game-card-head">
        <span className="game-emoji" aria-hidden>
          {info.emoji}
        </span>
        <span className="game-card-name">{game.name}</span>
      </span>
      <span className="game-tagline">{game.tagline}</span>
      <span className="tags">
        <span className="tag">
          {game.minPlayers}〜{game.maxPlayers}人
        </span>
        <span className="tag">{info.duration}</span>
        <span className="tag">{info.style}</span>
        {game.publicBoard && <span className="tag tag-public">タブレット1台◎</span>}
      </span>
    </>
  );
}

export function accentStyle(id: GameId) {
  return { "--accent": GAME_META[id].color } as React.CSSProperties;
}

/** 今の人数でそのゲームを遊べないときの理由 */
export function playerCountIssue(id: GameId, count: number): string | null {
  const game = GAMES[id];
  if (count >= game.minPlayers && count <= game.maxPlayers) return null;
  return `${game.minPlayers}〜${game.maxPlayers}人で遊べます（今は${count}人）`;
}

interface Props {
  current: GameId;
  playerCount: number;
  /** ホスト以外は選べない */
  canPick: boolean;
  onPick: (id: GameId) => void;
  /** grid: 結果画面用の一覧 / scroll: ロビー用の横スクロール */
  layout: "grid" | "scroll";
  /** 人数が合わないゲームを選べなくする（結果画面では true。ロビーはこれから人が増えるので false） */
  strictCount: boolean;
  excludeCurrent?: boolean;
}

export function GamePicker({
  current,
  playerCount,
  canPick,
  onPick,
  layout,
  strictCount,
  excludeCurrent,
}: Props) {
  const ids = GAME_ORDER.filter((id) => !(excludeCurrent && id === current));
  const containerRef = useRef<HTMLDivElement>(null);

  // 横スクロールでは、選択中のゲームが見える位置までスクロールする
  useEffect(() => {
    if (layout !== "scroll") return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-game="${current}"]`);
    if (el && containerRef.current) {
      containerRef.current.scrollTo({ left: el.offsetLeft - 8, behavior: "smooth" });
    }
  }, [current, layout]);

  return (
    <div ref={containerRef} className={layout === "grid" ? "game-grid" : "game-scroll"}>
      {ids.map((id) => {
        const issue = playerCountIssue(id, playerCount);
        const selected = id === current;
        const disabled = !canPick || selected || (strictCount && issue !== null);
        const unavailable = !selected && strictCount && issue !== null;
        return (
          <div
            key={id}
            data-game={id}
            className={`game-card game-card-pickable ${selected ? "game-card-selected" : ""} ${unavailable ? "game-card-unavailable" : ""}`}
            style={accentStyle(id)}
          >
            <button
              type="button"
              className="game-card-main"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onPick(id)}
            >
              <GameCardBody id={id} />
              {selected && <span className="game-card-note">選択中</span>}
              {!selected && issue && <span className="game-card-note game-card-warn">{issue}</span>}
            </button>
            <RulesButton gameId={id} />
          </div>
        );
      })}
    </div>
  );
}
