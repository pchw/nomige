import { useEffect, useState } from "react";
import type { PlayingCard } from "~/games/high-low";
import {
  HAND_SIZE,
  NIUNIU,
  NO_NIU,
  cardValue,
  pointsLabel,
  type Hand,
  type NiuniuAction,
  type NiuniuPlayerView,
  type NiuniuTableView,
} from "~/games/niuniu";
import type { PlayerId } from "~/games/types";
import { Avatar, PlayerChip } from "../ui";
import { ThrowBar } from "./controls";
import { Trump } from "./HighLowUI";
import type { GameUIProps } from "./types";

type Props = GameUIProps<NiuniuTableView, NiuniuPlayerView, NiuniuAction>;

/** 1枚ずつ時間差でめくれる。めくった直後だけ動く（同じ key のままなら再生しない） */
function FlipCard({ card, order }: { card: PlayingCard; order: number }) {
  return (
    <span className="nn-flip" style={{ animationDelay: `${order * 0.18}s` }}>
      <Trump card={card} />
    </span>
  );
}

/** 点数の札。数字はそのまま、ウーニューは地味に、ニューニューは派手に */
export function Points({ points }: { points: number }) {
  const tone = points === NIUNIU ? "nn-points-niuniu" : points === NO_NIU ? "nn-points-none" : "";
  return (
    <span className={`nn-points ${tone}`}>
      {points === NIUNIU && "🐮 "}
      {pointsLabel(points)}
      {points === NIUNIU && "！"}
    </span>
  );
}

/** カードの束と、その下の足し算 */
export function CardGroup({
  cards,
  from = 0,
  ten,
  caption,
}: {
  cards: PlayingCard[];
  /** めくる順番（時間差）の開始位置 */
  from?: number;
  /** 10の倍数になった3枚 */
  ten?: boolean;
  caption: string;
}) {
  return (
    <span className={`nn-group ${ten ? "nn-group-ten" : ""}`}>
      <span className="nn-group-cards">
        {cards.map((c, i) => (
          <FlipCard key={`${c.suit}${c.rank}`} card={c} order={from + i} />
        ))}
      </span>
      <span className="nn-sum">{caption}</span>
    </span>
  );
}

const sumText = (cards: PlayingCard[]) => {
  const v = cards.map(cardValue);
  return `${v.join("+")} = ${v.reduce((a, b) => a + b, 0)}`;
};

/** 手札。めくったら、10の倍数になる3枚と残り2枚に分けて並べる */
export function HandCards({ hand }: { hand: Hand | null }) {
  if (!hand) {
    return (
      <div className="nn-cards">
        <span className="nn-group-cards">
          {Array.from({ length: HAND_SIZE }, (_, i) => (
            <Trump key={i} card={null} />
          ))}
        </span>
      </div>
    );
  }
  if (!hand.triple) {
    return (
      <div className="nn-cards">
        <CardGroup cards={hand.cards} caption="どの3枚でも10の倍数にならない" />
      </div>
    );
  }
  const ten = hand.triple.map((i) => hand.cards[i]);
  const rest = hand.cards.filter((_, i) => !hand.triple!.includes(i));
  return (
    <div className="nn-cards">
      <CardGroup cards={ten} ten caption={sumText(ten)} />
      <CardGroup cards={rest} from={3} caption={sumText(rest)} />
    </div>
  );
}

/** カードが全部めくれて点数が出るまで（CSS の時間差と合わせる） */
const REVEAL_MS = 1300;

/**
 * めくった人数が増えてから REVEAL_MS たつまで false。
 * その間は直前の人を除いて「一番低い人」を出し、めくれ終わる前に結論が見えないようにする。
 */
function useSettled(count: number): boolean {
  const [settledAt, setSettledAt] = useState(count);
  useEffect(() => {
    if (count === settledAt) return;
    const t = setTimeout(() => setSettledAt(count), REVEAL_MS);
    return () => clearTimeout(t);
  }, [count, settledAt]);
  return count === settledAt;
}

function lowestOf(ids: PlayerId[], hands: NiuniuTableView["hands"]): PlayerId[] {
  const min = Math.min(...ids.map((id) => hands[id]!.points));
  return ids.filter((id) => hands[id]!.points === min);
}

/** めくる順（最初の人から）に並べる */
function turnOrder(table: NiuniuTableView): PlayerId[] {
  const { order, turnIndex } = table;
  return order.map((_, i) => order[(turnIndex + i) % order.length]);
}

export function NiuniuUI({ table, view, me, players, act }: Props) {
  const myTurn = !!me && !!view?.isMyTurn;
  const flipping = table.phase === "flip";
  const current = table.currentPlayerId ? players.get(table.currentPlayerId) : undefined;
  const names = (ids: PlayerId[]) => ids.map((id) => players.get(id)?.name).join("・");
  const settled = useSettled(table.flipped.length);
  const judged = settled ? table.flipped : table.flipped.slice(0, -1);
  const lowest = lowestOf(judged, table.hands);
  // 1人目がめくった時点では「一番低い」と言っても意味がない
  const showLowest = judged.length >= 2;

  return (
    <div className="game niuniu">
      {table.safe.length > 0 && (
        <section className="seat-row">
          {table.safe.map((p) => (
            <PlayerChip
              key={p.playerId}
              player={players.get(p.playerId)}
              dim
              badge={`セーフ ${pointsLabel(p.points)}`}
            />
          ))}
        </section>
      )}

      <section className="turn-banner">
        {flipping ? (
          <>
            <strong>{current?.name}</strong> がめくる番
            <span className="muted">
              残り {table.order.length - table.flipped.length} 人
              {table.lastFlip?.auto &&
                `（直前の ${players.get(table.lastFlip.playerId)?.name} はおまかせ）`}
            </span>
          </>
        ) : !settled ? (
          // 最後の人のカードがめくれ終わるまで結論を伏せる
          <strong>さあ、どうだ…</strong>
        ) : (
          <span className="nn-verdict">
            {table.verdict === "lose" && (
              <>
                <strong>{names(lowest)}</strong> が一番低い！
              </>
            )}
            {table.verdict === "runoff" && (
              <>
                同点！<strong>{names(lowest)}</strong> で延長戦
              </>
            )}
            {table.verdict === "roulette" && <>まだ同点！ルーレットで決める</>}
          </span>
        )}
      </section>

      <section className={`panel nn-board ${myTurn ? "hand-active" : ""}`}>
        {table.runoff > 0 && (
          <p className="nn-runoff">
            延長戦 {table.runoff} 回目
            <span className="muted small">（同点だった人だけで配り直し）</span>
          </p>
        )}
        <div className="nn-rows">
          {turnOrder(table).map((id) => {
            const player = players.get(id);
            const hand = table.hands[id];
            const isTurn = id === table.currentPlayerId;
            const isLow = showLowest && lowest.includes(id);
            const cls = [
              "nn-row",
              isTurn ? "nn-row-turn" : "",
              isLow ? "nn-row-low" : "",
              hand?.points === NIUNIU ? "nn-row-niuniu" : "",
            ].join(" ");
            return (
              <div key={id} className={cls}>
                <div className="nn-row-head">
                  {player && <Avatar character={player.character} size="sm" />}
                  <span className="nn-name">{player?.name}</span>
                  {isTurn && <span className="nn-tag">めくる番</span>}
                  {id === table.nextPlayerId && <span className="nn-tag nn-tag-next">NEXT</span>}
                  {isLow && (
                    <span className="nn-tag nn-tag-low">
                      {flipping || !settled
                        ? "今いちばん低い"
                        : table.verdict === "lose"
                          ? "負け"
                          : "同点"}
                    </span>
                  )}
                  {hand && <Points points={hand.points} />}
                </div>
                <HandCards hand={hand} />
              </div>
            );
          })}
        </div>
        <p className="muted small nn-note">
          J・Q・K は 10。3枚で10の倍数を作れたら、残り2枚の合計の下一桁が点数
        </p>
      </section>

      {myTurn && (
        <ThrowBar tone="btn-peach" onClick={() => act({ type: "flip" })}>
          めくる！
        </ThrowBar>
      )}
    </div>
  );
}
