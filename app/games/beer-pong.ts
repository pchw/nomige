import { tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

/**
 * テーブルの座標（上から見る）。投げる位置は手前の真ん中、カップは奥に三角形に並ぶ。
 * 投げる方向と強さで落ちる場所が決まり、そこにカップがあれば入る。
 */
export const TABLE_WIDTH = 80;
export const TABLE_LENGTH = 240;
export const THROW_FROM = { x: TABLE_WIDTH / 2, y: 8 };
export const CUP_RADIUS = 4.5;
export const BALL_RADIUS = 2;
/** カップの中心からこの距離以内に落ちたら入る */
export const CATCH_RADIUS = 3.2;
/** ここまでは縁に当たって弾かれる */
export const RIM_RADIUS = CUP_RADIUS + BALL_RADIUS;
const CUP_GAP = CUP_RADIUS * 2 + 0.4;
const FRONT_CUP_Y = 190;

export const POWER_MAX = 100;
export const ANGLE_MAX = 12;

/** 飛んでいる時間と、落ちた後に結果を見せる時間 */
export const FLIGHT_MS = 1400;
export const BOUNCE_MS = 400;
const AFTER_MS = 1300;
/** 長引いたときの打ち切り */
const MAX_THROWS = 80;

export interface BeerPongConfig {
  wobble: "low" | "normal" | "high";
}

/** [距離のぶれ（割合）, 方向のぶれ（±度）] */
const WOBBLE: Record<BeerPongConfig["wobble"], [number, number]> = {
  low: [0.02, 0.75],
  normal: [0.03, 1.1],
  high: [0.045, 1.7],
};

export interface Cup {
  id: number;
  x: number;
  y: number;
  /** 入れた人（入ったカップは片付ける） */
  takenBy: PlayerId | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface Throw {
  playerId: PlayerId;
  angle: number;
  power: number;
  land: Point;
  result: "in" | "rim" | "miss";
  cupId: number | null;
  /** 弾かれたボールが転がっていく先 */
  bounce: Point;
  startedAt: number;
  auto: boolean;
}

export interface BeerPongState {
  phase: "aim" | "flying" | "done";
  wobble: BeerPongConfig["wobble"];
  /** まだ入れていない人（投げる順） */
  remaining: PlayerId[];
  turnIndex: number;
  exited: { playerId: PlayerId; cupId: number }[];
  cups: Cup[];
  throws: number;
  shot: Throw | null;
}

export type BeerPongAction = { type: "throw"; angle: number; power: number };

export interface BeerPongTableView {
  phase: BeerPongState["phase"];
  remaining: PlayerId[];
  currentPlayerId: PlayerId | null;
  exited: BeerPongState["exited"];
  cups: Cup[];
  shot: Throw | null;
  wobble: [number, number];
}

export interface BeerPongPlayerView {
  isMyTurn: boolean;
}

/** 手前の1個から奥の4個まで、三角形に並べる */
export function initialCups(): Cup[] {
  return [0, 1, 2, 3]
    .flatMap((row) =>
      Array.from({ length: row + 1 }, (_, i) => ({
        x: TABLE_WIDTH / 2 + (i - row / 2) * CUP_GAP,
        y: FRONT_CUP_Y + row * CUP_GAP * 0.866,
      })),
    )
    .map((c, id) => ({ id, ...c, takenBy: null }));
}

/** 強さで決まる飛ぶ距離 */
export function distanceFor(power: number): number {
  return 120 + power * 1.2;
}

export function powerFor(distance: number): number {
  return Math.min(POWER_MAX, Math.max(0, (distance - 120) / 1.2));
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** ぶれなしで落ちる場所 */
export function landingPoint(angle: number, power: number): Point {
  const d = distanceFor(power);
  return { x: THROW_FROM.x + d * Math.sin(rad(angle)), y: THROW_FROM.y + d * Math.cos(rad(angle)) };
}

/** 狙った場所に落とす方向と強さ（画面タップ用） */
export function aimAt(p: Point): { angle: number; power: number } {
  const dx = p.x - THROW_FROM.x;
  const dy = Math.max(1, p.y - THROW_FROM.y);
  const angle = Math.min(ANGLE_MAX, Math.max(-ANGLE_MAX, (Math.atan2(dx, dy) * 180) / Math.PI));
  return { angle, power: powerFor(Math.hypot(dx, dy)) };
}

/** 落ちた場所の判定（入る / 縁で弾かれる / 外れ） */
export function judge(cups: Cup[], land: Point): { result: Throw["result"]; cup: Cup | null } {
  let nearest: Cup | null = null;
  let best = Infinity;
  for (const c of cups) {
    if (c.takenBy) continue;
    const d = Math.hypot(c.x - land.x, c.y - land.y);
    if (d < best) {
      best = d;
      nearest = c;
    }
  }
  if (nearest && best <= CATCH_RADIUS) return { result: "in", cup: nearest };
  if (nearest && best <= RIM_RADIUS) return { result: "rim", cup: nearest };
  return { result: "miss", cup: null };
}

function current(s: BeerPongState): PlayerId | null {
  return s.phase === "aim" ? s.remaining[s.turnIndex] : null;
}

function throwBall(
  state: BeerPongState,
  playerId: PlayerId,
  angle: number,
  power: number,
  auto: boolean,
  ctx: Ctx,
): Step<BeerPongState> {
  if (state.phase !== "aim") fail("not_aiming", "今は投げられません");
  if (current(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (!Number.isFinite(angle) || !Number.isFinite(power)) fail("invalid_throw", "不正な値です");
  const s = structuredClone(state);
  const a = Math.min(ANGLE_MAX, Math.max(-ANGLE_MAX, angle));
  const p = Math.min(POWER_MAX, Math.max(0, power));
  const [distWobble, angleWobble] = WOBBLE[s.wobble];
  const d = distanceFor(p) * (1 + (ctx.random() * 2 - 1) * distWobble);
  const actual = a + (ctx.random() * 2 - 1) * angleWobble;
  const land = {
    x: THROW_FROM.x + d * Math.sin(rad(actual)),
    y: THROW_FROM.y + d * Math.cos(rad(actual)),
  };
  const { result, cup } = judge(s.cups, land);

  // 弾かれたボールの行き先（見た目だけ）
  let bounce = land;
  if (result === "rim" && cup) {
    const dx = land.x - cup.x;
    const dy = land.y - cup.y;
    const len = Math.hypot(dx, dy) || 1;
    bounce = { x: cup.x + (dx / len) * 20, y: cup.y + (dy / len) * 20 };
  } else if (result === "miss") {
    bounce = { x: land.x + d * 0.08 * Math.sin(rad(actual)), y: land.y + d * 0.12 };
  }

  s.throws++;
  s.shot = {
    playerId,
    angle: a,
    power: p,
    land,
    result,
    cupId: cup && result === "in" ? cup.id : null,
    bounce,
    startedAt: ctx.now,
    auto,
  };
  s.phase = "flying";
  return {
    state: s,
    timer: { id: "settle", at: ctx.now + FLIGHT_MS + BOUNCE_MS + AFTER_MS },
    events: [{ name: "beerpong.throw", data: { playerId, result } }],
  };
}

function settle(state: BeerPongState, ctx: Ctx): Step<BeerPongState> {
  const s = structuredClone(state);
  const shot = s.shot!;
  if (shot.result === "in" && shot.cupId !== null) {
    s.cups[shot.cupId].takenBy = shot.playerId;
    s.exited.push({ playerId: shot.playerId, cupId: shot.cupId });
    s.remaining.splice(s.turnIndex, 1);
    // 抜けた人の次の人が同じ位置に詰めてくる
    if (s.turnIndex >= s.remaining.length) s.turnIndex = 0;
  } else {
    s.turnIndex = (s.turnIndex + 1) % s.remaining.length;
  }

  if (s.remaining.length === 1) {
    s.phase = "done";
    return {
      state: s,
      timer: null,
      result: { losers: s.remaining, reason: "最後までカップに入れられなかった" },
    };
  }
  if (s.throws >= MAX_THROWS) {
    s.phase = "done";
    const tb = tieBreak(ctx.random, s.remaining);
    return {
      state: s,
      timer: null,
      result: { losers: [tb.chosen], reason: "決着がつかずルーレット", tieBreak: tb },
    };
  }
  s.phase = "aim";
  return { state: s, timer: null };
}

export const beerPong: GameDefinition<
  BeerPongConfig,
  BeerPongState,
  BeerPongAction,
  BeerPongTableView,
  BeerPongPlayerView
> = {
  id: "beer-pong",
  name: "ビアポン",
  tagline: "カップにボールを入れた人から抜ける。最後まで入れられなかった人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { wobble: "normal" },
  configFields: [
    {
      key: "wobble",
      label: "投げのぶれ",
      options: [
        { value: "low", label: "小さい（入りやすい）" },
        { value: "normal", label: "ふつう" },
        { value: "high", label: "大きい（入りにくい）" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const start = Math.floor(ctx.random() * players.length);
    const s: BeerPongState = {
      phase: "aim",
      wobble: config.wobble,
      remaining: players.map((_, i) => players[(start + i) % players.length]),
      turnIndex: 0,
      exited: [],
      cups: initialCups(),
      throws: 0,
      shot: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "throw") fail("invalid_action", "不正な操作です");
    return throwBall(state, playerId, action.angle, action.power, false, ctx);
  },

  onTimer(state, timerId, ctx) {
    if (timerId === "settle" && state.phase === "flying") return settle(state, ctx);
    return { state };
  },

  /** 残っているカップを1つ選んで真ん中を狙う */
  autoAct(state, ctx) {
    const playerId = current(state);
    if (!playerId) return { state };
    const left = state.cups.filter((c) => !c.takenBy);
    const target = left[Math.floor(ctx.random() * left.length)];
    const { angle, power } = aimAt(target);
    return throwBall(state, playerId, angle, power, true, ctx);
  },

  tableView(s) {
    return {
      phase: s.phase,
      remaining: s.remaining,
      currentPlayerId: current(s),
      exited: s.exited,
      cups: s.cups,
      shot: s.shot,
      wobble: WOBBLE[s.wobble],
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
