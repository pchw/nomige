import { useState } from "react";
import {
  aimAt,
  ANGLE_MAX,
  BALL_RADIUS,
  BOUNCE_MS,
  CUP_RADIUS,
  distanceFor,
  FLIGHT_MS,
  landingPoint,
  POWER_MAX,
  TABLE_WIDTH,
  THROW_FROM,
  type BeerPongAction,
  type BeerPongPlayerView,
  type BeerPongTableView,
  type Point,
  type Throw,
} from "~/games/beer-pong";
import { CHARACTERS } from "~/games/characters";
import { PlayerChip, useNow, type PlayerMap } from "../ui";
import { FineSlider, svgPoint } from "./controls";
import type { GameUIProps } from "./types";

type Props = GameUIProps<BeerPongTableView, BeerPongPlayerView, BeerPongAction>;

/** 画面に出すのはカップのまわり（手前は省略）。テーブル座標の y をこの範囲で描く */
const VIEW_NEAR = 100;
const VIEW_FAR = 234;
const sy = (y: number) => VIEW_FAR - y;
const rad = (deg: number) => (deg * Math.PI) / 180;
const lerp = (a: Point, b: Point, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const RESULT_TEXT: Record<Throw["result"], string> = {
  in: "IN！🍺",
  rim: "縁で弾かれた！",
  miss: "外れ…",
};

/** 投げてからの経過時間でのボールの位置・高さ */
function ballAt(shot: Throw, elapsed: number): { pos: Point; height: number; inCup: boolean } {
  if (elapsed < FLIGHT_MS) {
    const u = elapsed / FLIGHT_MS;
    return { pos: lerp(THROW_FROM, shot.land, u), height: 4 * 30 * u * (1 - u), inCup: false };
  }
  const u = Math.min(1, (elapsed - FLIGHT_MS) / BOUNCE_MS);
  if (shot.result === "in") return { pos: shot.land, height: 0, inCup: true };
  // 弾かれたら小さく跳ねて転がっていく
  return { pos: lerp(shot.land, shot.bounce, u), height: 6 * u * (1 - u), inCup: false };
}

function CupMark({ cup, players }: { cup: BeerPongTableView["cups"][number]; players: PlayerMap }) {
  if (cup.takenBy) {
    const p = players.get(cup.takenBy);
    return (
      <g transform={`translate(${cup.x} ${sy(cup.y)})`}>
        <circle className="pong-cup-taken" r={CUP_RADIUS} />
        <text textAnchor="middle" dominantBaseline="central" fontSize={5}>
          {p ? CHARACTERS[p.character].emoji : ""}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${cup.x} ${sy(cup.y)})`}>
      <circle className="pong-cup" r={CUP_RADIUS} />
      <circle className="pong-beer" r={CUP_RADIUS - 1.3} />
    </g>
  );
}

export function BeerPongUI({ table, view, me, players, act, serverNow }: Props) {
  const now = useNow(serverNow, 33);
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(60);
  const myTurn = !!me && !!view?.isMyTurn;
  const shot = table.phase === "flying" ? table.shot : null;
  // 端末の時計のずれで開始前になることがあるので 0 で止める
  const elapsed = shot ? Math.max(0, now - shot.startedAt) : 0;
  const landed = !!shot && elapsed >= FLIGHT_MS + BOUNCE_MS;
  const thrower = players.get((shot?.playerId ?? table.currentPlayerId) || "");

  const target = landingPoint(angle, power);
  const d = distanceFor(power);
  const [distWobble, angleWobble] = table.wobble;

  const onTap = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!myTurn) return;
    const p = svgPoint(e);
    if (!p) return;
    const aim = aimAt({ x: p.x, y: sy(p.y) });
    setAngle(Math.round(aim.angle * 10) / 10);
    setPower(Math.round(aim.power * 2) / 2);
  };

  const ball = shot ? ballAt(shot, elapsed) : null;

  return (
    <div className="game beer-pong">
      {thrower && (
        <section className="turn-banner">
          <PlayerChip player={thrower} active />
          <span>{shot ? "が投げた！" : "の番"}</span>
        </section>
      )}

      <section className={`panel pong-board ${myTurn ? "hand-active" : ""}`}>
        <svg
          className="pong-table"
          viewBox={`-4 -2 ${TABLE_WIDTH + 8} ${VIEW_FAR - VIEW_NEAR + 4}`}
          onPointerDown={onTap}
          role="img"
          aria-label="テーブル"
        >
          <rect
            className="pong-wood"
            x={0}
            y={0}
            width={TABLE_WIDTH}
            height={VIEW_FAR - VIEW_NEAR}
          />
          {table.cups.map((c) => (
            <CupMark key={c.id} cup={c} players={players} />
          ))}

          {myTurn && !shot && (
            <g transform={`translate(${target.x} ${sy(target.y)}) rotate(${-angle})`}>
              <ellipse
                className="pong-spread"
                rx={Math.max(0.5, d * Math.sin(rad(angleWobble)))}
                ry={Math.max(0.5, d * distWobble)}
              />
              <path className="pong-cross" d="M -3 0 H 3 M 0 -3 V 3" />
            </g>
          )}

          {ball && !ball.inCup && (
            <g>
              <ellipse
                className="pong-shadow"
                cx={ball.pos.x}
                cy={sy(ball.pos.y)}
                rx={BALL_RADIUS}
                ry={BALL_RADIUS * 0.6}
              />
              <circle
                className="pong-ball"
                cx={ball.pos.x}
                cy={sy(ball.pos.y) - ball.height}
                r={BALL_RADIUS * (1 + ball.height / 30)}
              />
            </g>
          )}
        </svg>

        {shot && landed && (
          <p className={`pong-result pong-result-${shot.result}`}>{RESULT_TEXT[shot.result]}</p>
        )}

        {myTurn && !shot && (
          <div className="aim-controls">
            <FineSlider
              label="方向"
              value={angle}
              min={-ANGLE_MAX}
              max={ANGLE_MAX}
              step={0.1}
              format={(v) => `${v > 0 ? "右" : v < 0 ? "左" : ""}${Math.abs(v).toFixed(1)}°`}
              onChange={setAngle}
            />
            <FineSlider
              label="強さ"
              value={power}
              min={0}
              max={POWER_MAX}
              step={0.5}
              format={(v) => v.toFixed(1)}
              onChange={setPower}
            />
            <p className="muted small">
              狙いたいカップをタップすると、そこに向けて合わせる。黄色の範囲のどこかに落ちる
            </p>
            <button
              type="button"
              className="btn btn-xl btn-block btn-coral"
              onClick={() => act({ type: "throw", angle, power })}
            >
              投げる 🏓
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">まだ入れていない人</h3>
        <div className="seat-row">
          {table.remaining.map((id) => (
            <PlayerChip
              key={id}
              player={players.get(id)}
              active={id === (shot?.playerId ?? table.currentPlayerId)}
            />
          ))}
        </div>
        {table.exited.length > 0 && (
          <div className="seat-row seat-row-dim">
            {table.exited.map((e, i) => (
              <PlayerChip
                key={e.playerId}
                player={players.get(e.playerId)}
                dim
                badge={`${i + 1}抜け`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
