import { useState } from "react";
import { CHARACTERS } from "~/games/characters";
import {
  distanceToEdge,
  GLASS_RADIUS,
  POWER_MAX,
  reach,
  START_Y,
  TABLE_LENGTH,
  TABLE_WIDTH,
  type Glass,
  type GlassSlideAction,
  type GlassSlidePlayerView,
  type GlassSlideTableView,
} from "~/games/glass-slide";
import type { PlayerId } from "~/games/types";
import { frameAt } from "~/games/physics";
import { PlayerChip, useNow, type PlayerMap } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<GlassSlideTableView, GlassSlidePlayerView, GlassSlideAction>;

/** テーブル座標（奥の端が y = TABLE_LENGTH）を SVG 座標（上が奥）に変換 */
const sy = (y: number) => TABLE_LENGTH - y;

interface Pos {
  playerId: PlayerId;
  x: number;
  y: number;
}

/** 滑っている最中は記録された軌跡から、それ以外は確定した位置から描く */
function positionsAt(table: GlassSlideTableView, now: number): Pos[] {
  const shot = table.shot;
  if (table.phase !== "sliding" || !shot) return table.glasses;
  const frame = frameAt(shot.frames, now - shot.startedAt);
  // 前の手番までに落ちたグラスは軌跡に含まれないので、そのまま描く
  const before = table.glasses.filter((g) => !shot.ids.includes(g.playerId));
  return [
    ...before,
    ...shot.ids.map((playerId, k) => ({ playerId, x: frame[2 * k], y: frame[2 * k + 1] })),
  ];
}

function GlassMark({ pos, players, ghost }: { pos: Pos; players: PlayerMap; ghost?: boolean }) {
  const player = players.get(pos.playerId);
  const c = player ? CHARACTERS[player.character] : undefined;
  return (
    <g
      transform={`translate(${pos.x} ${sy(pos.y)})`}
      className={ghost ? "glass-ghost" : "glass-mark"}
    >
      <circle r={GLASS_RADIUS} fill={ghost ? "none" : (c?.color ?? "#fff")} />
      {!ghost && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={6}>
          {c?.emoji}
        </text>
      )}
    </g>
  );
}

function TableSvg({
  table,
  players,
  now,
  aim,
}: {
  table: GlassSlideTableView;
  players: PlayerMap;
  now: number;
  aim: { playerId: PlayerId; x: number; power: number } | null;
}) {
  const positions = positionsAt(table, now);
  const target = aim ? START_Y + reach(aim.power) : 0;
  // 止まる位置のぶれ幅（距離は速さの2乗に比例するので、ムラの約2倍）
  const spread = aim ? reach(aim.power) * table.wobble * 2 : 0;
  return (
    <svg
      className="glass-table"
      viewBox={`-14 -30 ${TABLE_WIDTH + 28} ${TABLE_LENGTH + 44}`}
      role="img"
      aria-label="テーブル"
    >
      <rect className="glass-floor" x={-14} y={-30} width={TABLE_WIDTH + 28} height={30} />
      <text className="glass-floor-text" x={TABLE_WIDTH / 2} y={-12} textAnchor="middle">
        ここに出たら落下
      </text>
      <rect className="glass-wood" x={0} y={0} width={TABLE_WIDTH} height={TABLE_LENGTH} />
      <line className="glass-edge" x1={0} y1={0} x2={TABLE_WIDTH} y2={0} />
      {[25, 50, 100, 150].map((d) => (
        <g key={d}>
          <line className="glass-tick" x1={0} y1={d} x2={TABLE_WIDTH} y2={d} />
          <text className="glass-tick-text" x={-2} y={d} textAnchor="end" dominantBaseline="middle">
            {d}
          </text>
        </g>
      ))}
      {aim && (
        <g>
          <rect
            className="glass-spread"
            x={0}
            y={sy(target + spread)}
            width={TABLE_WIDTH}
            height={spread * 2}
          />
          <line className="glass-target" x1={0} y1={sy(target)} x2={TABLE_WIDTH} y2={sy(target)} />
          <GlassMark
            pos={{ playerId: aim.playerId, x: aim.x, y: target }}
            players={players}
            ghost
          />
          <GlassMark pos={{ playerId: aim.playerId, x: aim.x, y: START_Y }} players={players} />
        </g>
      )}
      {positions.map((p) => (
        <GlassMark key={p.playerId} pos={p} players={players} />
      ))}
    </svg>
  );
}

/** 強さは 0.5 刻み */
const clampPower = (v: number) => Math.min(POWER_MAX, Math.max(0, Math.round(v * 2) / 2));

function statusOf(g: Glass | undefined): string {
  if (!g) return "…";
  if (g.fallen) return "落下！";
  return `あと ${Math.round(distanceToEdge(g)!)}cm`;
}

export function GlassSlideUI({ table, view, me, players, act, serverNow }: Props) {
  const now = useNow(serverNow, 33);
  const [x, setX] = useState(TABLE_WIDTH / 2);
  const [power, setPower] = useState(70);
  const myTurn = !!me && !!view?.isMyTurn;
  const current = table.currentPlayerId ? players.get(table.currentPlayerId) : undefined;
  const sliding = table.phase === "sliding";
  // 滑っている間、table.glasses はもう止まった後の位置なので、一覧では動いているグラスの結果を伏せる
  const settled = table.glasses;
  const byId = new Map(settled.map((g) => [g.playerId, g]));

  // 今のところ負けそうな人（落ちた人、いなければ一番遠い人）
  const onTable = settled.filter((g) => !g.fallen);
  const fallen = settled.filter((g) => g.fallen);
  const far = Math.max(...onTable.map((g) => distanceToEdge(g)!));
  const worst = new Set(
    (fallen.length > 0 ? fallen : onTable.filter((g) => distanceToEdge(g) === far)).map(
      (g) => g.playerId,
    ),
  );
  const shooter = table.shot ? players.get(table.shot.playerId) : undefined;

  return (
    <div className="game glass-slide">
      <section className="turn-banner">
        {sliding ? (
          <>
            <PlayerChip player={shooter} active />
            <span>のグラスが滑っていく…</span>
          </>
        ) : (
          current && (
            <>
              <PlayerChip player={current} active />
              <span>の番</span>
            </>
          )
        )}
      </section>

      <section className={`panel glass-board ${myTurn ? "hand-active" : ""}`}>
        <TableSvg
          table={table}
          players={players}
          now={now}
          aim={myTurn && me ? { playerId: me, x, power } : null}
        />
        {myTurn && (
          <div className="glass-controls">
            <label className="glass-slider">
              <span>位置</span>
              <input
                type="range"
                min={GLASS_RADIUS}
                max={TABLE_WIDTH - GLASS_RADIUS}
                step={1}
                value={x}
                onChange={(e) => setX(Number(e.target.value))}
              />
            </label>
            <label className="glass-slider">
              <span>強さ {power.toFixed(1)}</span>
              <input
                type="range"
                min={0}
                max={POWER_MAX}
                step={0.5}
                value={power}
                onChange={(e) => setPower(Number(e.target.value))}
              />
            </label>
            <div className="glass-fine">
              <button
                type="button"
                className="btn btn-sq"
                onClick={() => setPower((p) => clampPower(p - 0.5))}
                aria-label="少し弱く"
              >
                −
              </button>
              <span className="muted small">点線で止まる予定（ムラで黄色の幅だけぶれる）</span>
              <button
                type="button"
                className="btn btn-sq"
                onClick={() => setPower((p) => clampPower(p + 0.5))}
                aria-label="少し強く"
              >
                ＋
              </button>
            </div>
            <button
              type="button"
              className="btn btn-xl btn-block btn-amber"
              onClick={() => act({ type: "slide", x, power })}
            >
              すべらせる 🍺
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">端までの距離（手番順）</h3>
        <ol className="glass-list">
          {table.turnOrder.map((id) => {
            const g = sliding && table.shot?.ids.includes(id) ? undefined : byId.get(id);
            const moving = sliding && table.shot?.ids.includes(id);
            return (
              <li key={id} className={!sliding && worst.has(id) ? "glass-worst" : ""}>
                <PlayerChip
                  player={players.get(id)}
                  active={id === table.currentPlayerId}
                  dim={!byId.has(id) && id !== table.currentPlayerId}
                />
                <span className="glass-dist">
                  {moving ? "…" : id === table.currentPlayerId && !g ? "狙い中" : statusOf(g)}
                </span>
              </li>
            );
          })}
        </ol>
        {table.shot?.auto && !sliding && <p className="muted small">直前はおまかせで滑らせた</p>}
      </section>
    </div>
  );
}
