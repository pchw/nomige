import { useState } from "react";
import {
  ANGLE_MAX,
  angleWobbleAt,
  BALL_RADIUS,
  GUTTER,
  HEAD_PIN_Y,
  LANE_LENGTH,
  LANE_WIDTH,
  PIN_RADIUS,
  PINS,
  PIT,
  POWER_MAX,
  rollDurationMs,
  START_Y,
  type BowlingAction,
  type BowlingPlayerView,
  type BowlingTableView,
} from "~/games/bowling";
import { frameAt, frameIndexAt } from "~/games/physics";
import { PlayerChip, useNow } from "../ui";
import { FineSlider, svgPoint, ThrowBar } from "./controls";
import type { GameUIProps } from "./types";

type Props = GameUIProps<BowlingTableView, BowlingPlayerView, BowlingAction>;

const TOP = LANE_LENGTH + PIT;
/** レーン座標（奥が大きい y）を SVG 座標（上が奥）に変換 */
const sy = (y: number) => TOP - y;
const rad = (deg: number) => (deg * Math.PI) / 180;

function scoreText(pins: number, gutter: boolean): string {
  if (gutter) return "ガター…0本";
  if (pins === 10) return "ストライク！";
  return `${pins}本！`;
}

export function BowlingUI({ table, view, me, players, act, serverNow }: Props) {
  const now = useNow(serverNow, 33);
  const [x, setX] = useState(LANE_WIDTH / 2);
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(60);
  const myTurn = !!me && !!view?.isMyTurn;
  const roll = table.phase === "rolling" ? table.roll : null;
  const elapsed = roll ? Math.max(0, now - roll.startedAt) : 0;
  const finished = !!roll && elapsed >= rollDurationMs(roll);
  // 決着後（結果画面）は、負けた人の1投が止まった後の盤面を見せる
  const board = table.phase === "done" ? table.loserBoard : null;
  const thrower = players.get((roll?.playerId ?? board?.playerId ?? table.currentPlayerId) || "");

  // 転がっている間は記録された軌跡、決着後は負けた人の盤面、それ以外は並べ直したピン
  let ball = { x: myTurn ? x : LANE_WIDTH / 2, y: START_Y };
  let pins = PINS;
  // 今のコマまでに倒れたピン（倒れた瞬間に横倒しの形に変える）
  let down: boolean[] = PINS.map(() => false);
  if (roll) {
    const index = frameIndexAt(roll.frames, elapsed);
    down = roll.knockedAt.map((f) => f !== null && f <= index);
    const frame = frameAt(roll.frames, elapsed);
    ball = { x: frame[0], y: frame[1] };
    pins = PINS.map((_, i) => ({ x: frame[2 + 2 * i], y: frame[3 + 2 * i] }));
  } else if (board) {
    const frame = board.final;
    down = PINS.map((_, i) => board.knocked.includes(i));
    ball = { x: frame[0], y: frame[1] };
    pins = PINS.map((_, i) => ({ x: frame[2 + 2 * i], y: frame[3 + 2 * i] }));
  }

  // 狙いの線（ピンの奥まで）と、ぶれる扇
  const aimLength = HEAD_PIN_Y + 50 - START_Y;
  const spread = angleWobbleAt(table.angleWobble, power);
  const tip = (deg: number) => ({
    x: x + aimLength * Math.sin(rad(deg)),
    y: START_Y + aimLength * Math.cos(rad(deg)),
  });
  const [l, c, r] = [tip(angle - spread), tip(angle), tip(angle + spread)];

  const onTap = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!myTurn) return;
    const p = svgPoint(e);
    if (!p) return;
    const ty = sy(p.y);
    if (ty < START_Y + 20) return;
    const deg = (Math.atan2(p.x - x, ty - START_Y) * 180) / Math.PI;
    setAngle(Math.round(Math.min(ANGLE_MAX, Math.max(-ANGLE_MAX, deg)) * 4) / 4);
  };

  const lowest = Math.min(...Object.values(table.scores));

  return (
    <div className="game bowling">
      <section className="turn-banner">
        {table.rolloff > 0 && <span className="stage-label">延長戦 {table.rolloff}回目</span>}
        {thrower && (
          <>
            <PlayerChip player={thrower} active />
            <span>{roll ? "の投球" : board ? "の最後の1投" : "の番"}</span>
          </>
        )}
      </section>

      <section className={`panel bowling-board ${myTurn ? "hand-active" : ""}`}>
        <svg
          className="bowling-lane"
          viewBox={`${-GUTTER - 2} -2 ${LANE_WIDTH + GUTTER * 2 + 4} ${TOP + 4}`}
          onClick={onTap}
          role="img"
          aria-label="レーン"
        >
          <rect className="bowling-gutter" x={-GUTTER} y={0} width={GUTTER} height={TOP} />
          <rect className="bowling-gutter" x={LANE_WIDTH} y={0} width={GUTTER} height={TOP} />
          <rect
            className="bowling-pit"
            x={-GUTTER}
            y={0}
            width={LANE_WIDTH + GUTTER * 2}
            height={PIT}
          />
          <rect className="bowling-wood" x={0} y={PIT} width={LANE_WIDTH} height={LANE_LENGTH} />
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path
              key={i}
              className="bowling-arrow"
              d={`M ${(LANE_WIDTH * i) / 8 - 1.5} ${sy(60)} l 1.5 -4 l 1.5 4 z`}
            />
          ))}
          <line className="bowling-foul" x1={0} y1={sy(4)} x2={LANE_WIDTH} y2={sy(4)} />

          {myTurn && !roll && (
            <g>
              <path
                className="bowling-spread"
                d={`M ${x} ${sy(START_Y)} L ${l.x} ${sy(l.y)} L ${r.x} ${sy(r.y)} Z`}
              />
              <line className="bowling-aim" x1={x} y1={sy(START_Y)} x2={c.x} y2={sy(c.y)} />
            </g>
          )}

          {PINS.map((p, i) => (
            <circle key={`spot-${i}`} className="bowling-spot" cx={p.x} cy={sy(p.y)} r={1.2} />
          ))}
          {pins.map((p, i) => {
            if (!down[i]) {
              return (
                <circle key={i} className="bowling-pin" cx={p.x} cy={sy(p.y)} r={PIN_RADIUS} />
              );
            }
            // 動いた向きに横倒しにする
            const deg = (Math.atan2(-(p.y - PINS[i].y), p.x - PINS[i].x) * 180) / Math.PI;
            return (
              <g key={i} transform={`translate(${p.x} ${sy(p.y)}) rotate(${deg})`}>
                <rect
                  className="bowling-pin-lying"
                  x={-PIN_RADIUS * 1.6}
                  y={-PIN_RADIUS * 0.6}
                  width={PIN_RADIUS * 3.2}
                  height={PIN_RADIUS * 1.2}
                  rx={PIN_RADIUS * 0.6}
                />
                <line
                  className="bowling-pin-stripe"
                  x1={PIN_RADIUS * 0.6}
                  y1={-PIN_RADIUS * 0.6}
                  x2={PIN_RADIUS * 0.6}
                  y2={PIN_RADIUS * 0.6}
                />
              </g>
            );
          })}
          <circle className="bowling-ball" cx={ball.x} cy={sy(ball.y)} r={BALL_RADIUS} />
        </svg>

        {roll && !finished && (
          <p className="bowling-live">
            倒れた <b>{down.filter(Boolean).length}</b> 本
          </p>
        )}
        {roll && finished && (
          <p className={`bowling-result ${roll.knocked.length === 10 ? "bowling-strike" : ""}`}>
            {scoreText(roll.knocked.length, roll.gutter)}
          </p>
        )}
        {board && <p className="bowling-result">{scoreText(board.knocked.length, board.gutter)}</p>}

        {myTurn && !roll && (
          <div className="aim-controls">
            <FineSlider
              label="位置"
              value={x}
              min={BALL_RADIUS}
              max={LANE_WIDTH - BALL_RADIUS}
              step={1}
              format={(v) => `${Math.round(v - LANE_WIDTH / 2)}`}
              onChange={setX}
            />
            <FineSlider
              label="方向"
              value={angle}
              min={-ANGLE_MAX}
              max={ANGLE_MAX}
              step={0.25}
              format={(v) => `${v > 0 ? "右" : v < 0 ? "左" : ""}${Math.abs(v)}°`}
              onChange={setAngle}
            />
            <FineSlider
              label="強さ"
              value={power}
              min={0}
              max={POWER_MAX}
              step={1}
              onChange={setPower}
            />
            <p className="muted small">
              レーンをタップしても方向を決められる。強いほどピンは飛ぶが、黄色の扇の中でぶれる
            </p>
          </div>
        )}
        {myTurn && !roll && (
          <ThrowBar tone="btn-teal" onClick={() => act({ type: "roll", x, angle, power })}>
            投げる 🎳
          </ThrowBar>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">
          {table.rolloff > 0 ? "延長戦（最下位で並んだ人だけ）" : "倒したピン（手番順）"}
        </h3>
        <ol className="score-list">
          {table.thrower.map((id) => {
            // 転がっている間はその人の本数を伏せる
            const hidden = roll?.playerId === id && !finished;
            const score = hidden ? undefined : table.scores[id];
            const low = table.phase !== "rolling" && score !== undefined && score === lowest;
            return (
              <li key={id} className={low ? "score-low" : ""}>
                <PlayerChip
                  player={players.get(id)}
                  active={id === (roll?.playerId ?? table.currentPlayerId)}
                  dim={score === undefined && id !== table.currentPlayerId}
                />
                <span className="score-value">
                  {score !== undefined
                    ? `${score}本`
                    : id === table.currentPlayerId
                      ? "投球中"
                      : "…"}
                </span>
              </li>
            );
          })}
        </ol>
        {table.history.length > 0 && (
          <p className="muted small">
            {table.history
              .map(
                (h) =>
                  `${h.rolloff === 0 ? "本戦" : `延長${h.rolloff}`}：` +
                  Object.entries(h.scores)
                    .map(([id, n]) => `${players.get(id)?.name} ${n}`)
                    .join("・"),
              )
              .join(" ／ ")}
          </p>
        )}
      </section>
    </div>
  );
}
