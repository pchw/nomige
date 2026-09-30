import { body, FRAME_MS, simulate, type Body } from "./physics";
import { tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

/**
 * レーンの座標（上から見る）。y = 0 が投げる側、ピンは奥。x は 0〜LANE_WIDTH がレーンで、両側はガター。
 * ボールの中心がレーンの外に出たらガター（以降ピンに当たらない）。
 */
export const LANE_WIDTH = 60;
export const LANE_LENGTH = 200;
export const GUTTER = 8;
/** レーンの奥の落とし穴の深さ */
export const PIT = 12;
export const BALL_RADIUS = 6;
export const PIN_RADIUS = 4;
export const START_Y = 12;
export const HEAD_PIN_Y = 140;
const PIN_GAP_X = 17;
const PIN_GAP_Y = 15;

export const POWER_MAX = 100;
/** 投げる方向の範囲（度。右が正） */
export const ANGLE_MAX = 8;

const BALL = { r: BALL_RADIUS, m: 5, friction: 25 };
const PIN = { r: PIN_RADIUS, m: 1, friction: 60 };
const RESTITUTION = 0.9;
/** 元の位置からこれ以上動いたピンは倒れた扱い */
export const KNOCK_DISTANCE = 3;
const AFTER_ROLL_MS = 1500;
/** 延長戦はこの回数まで。それでも決まらなければルーレット */
const MAX_ROLLOFF = 3;

export interface BowlingConfig {
  /** 投げのぶれ */
  wobble: "low" | "normal" | "high";
}

/** 強さ 0 と 100 のときの方向のぶれ（±度） */
const ANGLE_WOBBLE: Record<BowlingConfig["wobble"], [number, number]> = {
  low: [0.3, 2.5],
  normal: [0.6, 4],
  high: [1, 6],
};

export interface Roll {
  playerId: PlayerId;
  x: number;
  angle: number;
  power: number;
  /** ぶれを含めた実際の方向 */
  actualAngle: number;
  /** frames[i] = [ボール, ピン1〜10] の [x, y, ...] */
  frames: number[][];
  knocked: number[];
  /** ピンごとに、倒れた扱いになったコマ（倒れなかったピンは null） */
  knockedAt: (number | null)[];
  gutter: boolean;
  startedAt: number;
  auto: boolean;
}

/** 1投の止まった後の盤面（結果画面で見せる。軌跡は持たないので小さい） */
export interface Board {
  playerId: PlayerId;
  /** [ボール, ピン1〜10] の止まった位置 [x, y, ...] */
  final: number[];
  knocked: number[];
  gutter: boolean;
}

export interface BowlingState {
  phase: "aim" | "rolling" | "done";
  wobble: BowlingConfig["wobble"];
  order: PlayerId[];
  /** 今の回で投げる人（手番順）。延長戦では同点の人だけ */
  thrower: PlayerId[];
  turnIndex: number;
  /** 0: 本戦 / 1〜: 延長戦 */
  rolloff: number;
  /** 今の回の倒したピンの数 */
  scores: Record<PlayerId, number>;
  /** 本戦の記録（表示用） */
  history: { rolloff: number; scores: Record<PlayerId, number> }[];
  roll: Roll | null;
  /** 各自の直近の1投の盤面 */
  boards: Record<PlayerId, Board>;
  loser: PlayerId | null;
}

export type BowlingAction = { type: "roll"; x: number; angle: number; power: number };

export interface BowlingTableView {
  phase: BowlingState["phase"];
  thrower: PlayerId[];
  currentPlayerId: PlayerId | null;
  rolloff: number;
  scores: Record<PlayerId, number>;
  history: BowlingState["history"];
  roll: Roll | null;
  /** 決着後に見せる、負けた人の1投 */
  loserBoard: Board | null;
  /** 強さ 0 / 100 のときの方向のぶれ（±度） */
  angleWobble: [number, number];
}

export interface BowlingPlayerView {
  isMyTurn: boolean;
}

/** ピンの初期位置（1番ピンが手前） */
export const PINS: { x: number; y: number }[] = [0, 1, 2, 3].flatMap((row) =>
  Array.from({ length: row + 1 }, (_, i) => ({
    x: LANE_WIDTH / 2 + (i - row / 2) * PIN_GAP_X,
    y: HEAD_PIN_Y + row * PIN_GAP_Y,
  })),
);

export function angleWobbleAt(range: [number, number], power: number): number {
  return range[0] + ((range[1] - range[0]) * power) / POWER_MAX;
}

function speedFor(power: number): number {
  return 90 + power * 2.1;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function isOffLane(b: Body): boolean {
  return b.x < 0 || b.x > LANE_WIDTH || b.y > LANE_LENGTH || b.y < 0;
}

/** 元の位置から KNOCK_DISTANCE より動いたか、レーンの外に出たピンは倒れた扱い */
export function isKnocked(spot: { x: number; y: number }, x: number, y: number): boolean {
  const offLane = x < 0 || x > LANE_WIDTH || y > LANE_LENGTH;
  return offLane || Math.hypot(x - spot.x, y - spot.y) > KNOCK_DISTANCE;
}

function current(s: BowlingState): PlayerId | null {
  return s.phase === "aim" ? s.thrower[s.turnIndex] : null;
}

export function rollDurationMs(roll: Roll): number {
  return (roll.frames.length - 1) * FRAME_MS;
}

/** 1投を計算する（純粋関数。テスト用に公開） */
export function throwBall(
  x: number,
  angle: number,
  power: number,
): { frames: number[][]; knocked: number[]; knockedAt: (number | null)[]; gutter: boolean } {
  const v = speedFor(power);
  const ball = body({
    ...BALL,
    x,
    y: START_Y,
    vx: v * Math.sin(rad(angle)),
    vy: v * Math.cos(rad(angle)),
  });
  const pins = PINS.map((p) => body({ ...PIN, x: p.x, y: p.y }));
  let gutter = false;
  const frames = simulate([ball, ...pins], {
    isOut: isOffLane,
    constrain: (b) => {
      // ピンに届く前にレーンの横から出たボールは、溝に落ちてまっすぐ転がる
      if (b === ball && !gutter && b.y < HEAD_PIN_Y && (b.x < 0 || b.x > LANE_WIDTH)) {
        gutter = true;
        b.x = b.x < 0 ? -GUTTER / 2 : LANE_WIDTH + GUTTER / 2;
        b.vy = Math.hypot(b.vx, b.vy);
        b.vx = 0;
      }
      // 奥のピット・溝の外側で止める
      const stop = b.y > LANE_LENGTH + PIT || b.x < -GUTTER || b.x > LANE_WIDTH + GUTTER;
      if (stop) {
        b.y = Math.min(b.y, LANE_LENGTH + PIT);
        b.x = Math.min(LANE_WIDTH + GUTTER, Math.max(-GUTTER, b.x));
        b.vx = 0;
        b.vy = 0;
      }
    },
    restitution: RESTITUTION,
  });
  // 一度でも元の位置から動いた（またはレーンの外に出た）ピンは、その時点で倒れた扱い
  const knockedAt = PINS.map((spot, i) => {
    const f = frames.findIndex((frame) => isKnocked(spot, frame[2 + 2 * i], frame[3 + 2 * i]));
    return f < 0 ? null : f;
  });
  const knocked = knockedAt.flatMap((f, i) => (f === null ? [] : [i]));
  return { frames, knocked, knockedAt, gutter };
}

function bowl(
  state: BowlingState,
  playerId: PlayerId,
  action: BowlingAction,
  auto: boolean,
  ctx: Ctx,
): Step<BowlingState> {
  if (state.phase !== "aim") fail("not_aiming", "今は投げられません");
  if (current(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (![action.x, action.angle, action.power].every(Number.isFinite))
    fail("invalid_roll", "不正な値です");
  const s = structuredClone(state);
  const x = Math.min(LANE_WIDTH - BALL_RADIUS, Math.max(BALL_RADIUS, action.x));
  const angle = Math.min(ANGLE_MAX, Math.max(-ANGLE_MAX, action.angle));
  const power = Math.min(POWER_MAX, Math.max(0, action.power));
  const spread = angleWobbleAt(ANGLE_WOBBLE[s.wobble], power);
  const actualAngle = angle + (ctx.random() * 2 - 1) * spread;
  const result = throwBall(x, actualAngle, power);
  s.scores[playerId] = result.knocked.length;
  s.boards[playerId] = {
    playerId,
    final: result.frames.at(-1)!,
    knocked: result.knocked,
    gutter: result.gutter,
  };
  s.roll = { playerId, x, angle, power, actualAngle, ...result, startedAt: ctx.now, auto };
  s.phase = "rolling";
  return {
    state: s,
    timer: { id: "settle", at: ctx.now + rollDurationMs(s.roll) + AFTER_ROLL_MS },
    events: [{ name: "bowling.roll", data: { playerId, knocked: result.knocked.length } }],
  };
}

function settle(state: BowlingState, ctx: Ctx): Step<BowlingState> {
  const s = structuredClone(state);
  if (s.turnIndex < s.thrower.length - 1) {
    s.turnIndex++;
    s.phase = "aim";
    return { state: s, timer: null };
  }
  s.history.push({ rolloff: s.rolloff, scores: s.scores });
  const min = Math.min(...s.thrower.map((p) => s.scores[p]));
  const lowest = s.thrower.filter((p) => s.scores[p] === min);
  if (lowest.length === 1) {
    s.phase = "done";
    s.loser = lowest[0];
    const reason =
      s.rolloff === 0 ? `${min}本で最下位` : `延長戦${s.rolloff}回目で ${min}本の最下位`;
    return { state: s, timer: null, result: { losers: lowest, reason } };
  }
  if (s.rolloff >= MAX_ROLLOFF) {
    s.phase = "done";
    const tb = tieBreak(ctx.random, lowest);
    s.loser = tb.chosen;
    return {
      state: s,
      timer: null,
      result: { losers: [tb.chosen], reason: "延長戦でも決まらずルーレット", tieBreak: tb },
    };
  }
  // 最下位で並んだ人だけで延長戦（手番順はそのまま）
  s.rolloff++;
  s.thrower = lowest;
  s.turnIndex = 0;
  s.scores = {};
  s.phase = "aim";
  return {
    state: s,
    timer: null,
    events: [{ name: "bowling.rolloff", data: { players: lowest, pins: min } }],
  };
}

export const bowling: GameDefinition<
  BowlingConfig,
  BowlingState,
  BowlingAction,
  BowlingTableView,
  BowlingPlayerView
> = {
  id: "bowling",
  name: "ボウリング",
  tagline: "1人1投。倒したピンが一番少ない人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { wobble: "normal" },
  configFields: [
    {
      key: "wobble",
      label: "投げのぶれ",
      options: [
        { value: "low", label: "小さい（腕前勝負）" },
        { value: "normal", label: "ふつう" },
        { value: "high", label: "大きい（運まかせ）" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const start = Math.floor(ctx.random() * players.length);
    const s: BowlingState = {
      phase: "aim",
      wobble: config.wobble,
      order: players,
      thrower: players.map((_, i) => players[(start + i) % players.length]),
      turnIndex: 0,
      rolloff: 0,
      scores: {},
      history: [],
      roll: null,
      boards: {},
      loser: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "roll") fail("invalid_action", "不正な操作です");
    return bowl(state, playerId, action, false, ctx);
  },

  onTimer(state, timerId, ctx) {
    if (timerId === "settle" && state.phase === "rolling") return settle(state, ctx);
    return { state };
  },

  /** 真ん中からまっすぐ、中くらいの強さで投げる */
  autoAct(state, ctx) {
    const playerId = current(state);
    if (!playerId) return { state };
    return bowl(
      state,
      playerId,
      { type: "roll", x: LANE_WIDTH / 2, angle: 0, power: 50 },
      true,
      ctx,
    );
  },

  tableView(s) {
    return {
      phase: s.phase,
      thrower: s.thrower,
      currentPlayerId: current(s),
      rolloff: s.rolloff,
      scores: s.scores,
      history: s.history,
      roll: s.roll,
      loserBoard: s.phase === "done" && s.loser ? s.boards[s.loser] : null,
      angleWobble: ANGLE_WOBBLE[s.wobble],
    };
  },

  playerView(s, playerId) {
    return { isMyTurn: current(s) === playerId };
  },

  pendingPlayers(s) {
    const p = current(s);
    return p ? [p] : [];
  },
};
