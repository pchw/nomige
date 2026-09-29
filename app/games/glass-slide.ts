import { tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

/**
 * テーブルの座標（単位は cm のつもり）。
 * y = 0 が手前（投げる側）、y = TABLE_LENGTH が奥の端。x は 0〜TABLE_WIDTH。
 * グラスの中心がテーブルの外に出たら落ちる。
 */
export const TABLE_LENGTH = 200;
export const TABLE_WIDTH = 100;
export const GLASS_RADIUS = 5;
export const START_Y = 10;
export const POWER_MAX = 100;

const FRICTION = 100; // 減速度（cm/s²）
const RESTITUTION = 0.85; // グラス同士の跳ね返り
const DT = 1 / 120;
const FRAME_EVERY = 4; // 30fps で軌跡を記録
export const FRAME_MS = DT * FRAME_EVERY * 1000;
const MAX_STEPS = 120 * 8;
const AFTER_SLIDE_MS = 1200;

export interface GlassSlideConfig {
  /** テーブルのムラ（強さのぶれ） */
  wobble: "low" | "normal" | "high";
}

const WOBBLE: Record<GlassSlideConfig["wobble"], number> = {
  low: 0.01,
  normal: 0.02,
  high: 0.04,
};

export interface Glass {
  playerId: PlayerId;
  x: number;
  y: number;
  fallen: boolean;
}

export interface Shot {
  playerId: PlayerId;
  x: number;
  power: number;
  /** ムラで実際に出た強さの倍率 */
  factor: number;
  /** frames[i] = ids の順に [x0, y0, x1, y1, ...] */
  ids: PlayerId[];
  frames: number[][];
  startedAt: number;
  auto: boolean;
}

export interface GlassSlideState {
  phase: "aim" | "sliding" | "done";
  wobble: GlassSlideConfig["wobble"];
  order: PlayerId[];
  startIndex: number;
  turnIndex: number;
  glasses: Glass[];
  shot: Shot | null;
}

export type GlassSlideAction = { type: "slide"; x: number; power: number };

export interface GlassSlideTableView {
  phase: GlassSlideState["phase"];
  wobble: number;
  turnOrder: PlayerId[];
  currentPlayerId: PlayerId | null;
  glasses: Glass[];
  shot: Shot | null;
}

export interface GlassSlidePlayerView {
  isMyTurn: boolean;
}

/** ムラなし・何にも当たらなかったときに進む距離 */
export function reach(power: number): number {
  return power * 2.4;
}

/** 奥の端までの距離（落ちたグラスは null） */
export function distanceToEdge(g: Glass): number | null {
  return g.fallen ? null : TABLE_LENGTH - g.y;
}

export function isOffTable(x: number, y: number): boolean {
  return x < 0 || x > TABLE_WIDTH || y < 0 || y > TABLE_LENGTH;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fallen: boolean;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 摩擦と円どうしの衝突だけの物理計算。落ちたグラスは他と当たらずに滑り続ける */
export function simulate(bodies: Body[]): number[][] {
  const frames: number[][] = [];
  const record = () => frames.push(bodies.flatMap((b) => [round1(b.x), round1(b.y)]));
  record();
  for (let step = 1; step <= MAX_STEPS; step++) {
    let moving = false;
    for (const b of bodies) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed === 0) continue;
      const dec = FRICTION * DT;
      if (speed <= dec) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }
      moving = true;
      const k = (speed - dec) / speed;
      b.vx *= k;
      b.vy *= k;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (!b.fallen && isOffTable(b.x, b.y)) b.fallen = true;
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
    }
    if (step % FRAME_EVERY === 0 || !moving) record();
    if (!moving) break;
  }
  return frames;
}

function collide(a: Body, b: Body) {
  if (a.fallen || b.fallen) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = GLASS_RADIUS * 2;
  if (dist >= min || dist === 0) return;
  const nx = dx / dist;
  const ny = dy / dist;
  // 近づいているときだけ跳ね返す（同じ重さの弾性衝突）
  const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approach > 0) {
    const j = ((1 + RESTITUTION) / 2) * approach;
    a.vx -= j * nx;
    a.vy -= j * ny;
    b.vx += j * nx;
    b.vy += j * ny;
  }
  // めり込みを半分ずつ押し戻す
  const push = (min - dist) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

function turnOrder(s: GlassSlideState): PlayerId[] {
  const n = s.order.length;
  return Array.from({ length: n }, (_, i) => s.order[(s.startIndex + i) % n]);
}

function current(s: GlassSlideState): PlayerId | null {
  return s.phase === "aim" ? turnOrder(s)[s.turnIndex] : null;
}

export function shotDurationMs(shot: Shot): number {
  return (shot.frames.length - 1) * FRAME_MS;
}

function slide(
  state: GlassSlideState,
  playerId: PlayerId,
  x: number,
  power: number,
  auto: boolean,
  ctx: Ctx,
): Step<GlassSlideState> {
  if (state.phase !== "aim") fail("not_aiming", "今は滑らせられません");
  if (current(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (!Number.isFinite(x) || !Number.isFinite(power)) fail("invalid_shot", "不正な値です");
  const s = structuredClone(state);
  const lane = Math.min(TABLE_WIDTH - GLASS_RADIUS, Math.max(GLASS_RADIUS, x));
  const p = Math.min(POWER_MAX, Math.max(0, power));
  const factor = 1 + (ctx.random() * 2 - 1) * WOBBLE[s.wobble];
  // 摩擦で止まるまでに reach(p) 進む初速
  const v0 = Math.sqrt(2 * FRICTION * reach(p)) * factor;

  const onTable = s.glasses.filter((g) => !g.fallen);
  const bodies: Body[] = [
    ...onTable.map((g) => ({ x: g.x, y: g.y, vx: 0, vy: 0, fallen: false })),
    { x: lane, y: START_Y, vx: 0, vy: v0, fallen: false },
  ];
  const ids = [...onTable.map((g) => g.playerId), playerId];
  const frames = simulate(bodies);

  const moved = new Map(
    bodies.map((b, i) => [
      ids[i],
      { playerId: ids[i], x: round1(b.x), y: round1(b.y), fallen: b.fallen },
    ]),
  );
  s.glasses = [...s.glasses.filter((g) => g.fallen), ...moved.values()];
  s.shot = { playerId, x: lane, power: p, factor, ids, frames, startedAt: ctx.now, auto };
  s.phase = "sliding";
  return {
    state: s,
    timer: { id: "settle", at: ctx.now + shotDurationMs(s.shot) + AFTER_SLIDE_MS },
    events: [{ name: "glass.slide", data: { playerId } }],
  };
}

function settle(state: GlassSlideState, ctx: Ctx): Step<GlassSlideState> {
  const s = structuredClone(state);
  if (s.turnIndex < s.order.length - 1) {
    s.turnIndex++;
    s.phase = "aim";
    return { state: s, timer: null };
  }
  s.phase = "done";
  const fallen = s.glasses.filter((g) => g.fallen).map((g) => g.playerId);
  let candidates: PlayerId[];
  let reason: string;
  let tieReason: string;
  if (fallen.length > 0) {
    candidates = fallen;
    reason = "グラスがテーブルから落ちた";
    tieReason = "テーブルから落ちた人の中からルーレット";
  } else {
    const far = Math.max(...s.glasses.map((g) => distanceToEdge(g)!));
    candidates = s.glasses.filter((g) => distanceToEdge(g) === far).map((g) => g.playerId);
    reason = `端まで ${Math.round(far)}cm で一番遠かった`;
    tieReason = `端まで ${Math.round(far)}cm で並んだ人からルーレット`;
  }
  // 席順で並べてからルーレットにかける
  candidates = s.order.filter((p) => candidates.includes(p));
  if (candidates.length === 1) {
    return { state: s, timer: null, result: { losers: candidates, reason } };
  }
  const tb = tieBreak(ctx.random, candidates);
  return {
    state: s,
    timer: null,
    result: { losers: [tb.chosen], reason: tieReason, tieBreak: tb },
  };
}

export const glassSlide: GameDefinition<
  GlassSlideConfig,
  GlassSlideState,
  GlassSlideAction,
  GlassSlideTableView,
  GlassSlidePlayerView
> = {
  id: "glass-slide",
  name: "グラスすべらせ",
  tagline: "テーブルの端ギリギリを狙ってグラスを滑らせる。一番遠い人か落とした人が負け",
  minPlayers: 3,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { wobble: "normal" },
  configFields: [
    {
      key: "wobble",
      label: "テーブルのムラ",
      options: [
        { value: "low", label: "小さい（腕前勝負）" },
        { value: "normal", label: "ふつう" },
        { value: "high", label: "大きい（運まかせ）" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const s: GlassSlideState = {
      phase: "aim",
      wobble: config.wobble,
      order: players,
      startIndex: Math.floor(ctx.random() * players.length),
      turnIndex: 0,
      glasses: [],
      shot: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "slide") fail("invalid_action", "不正な操作です");
    return slide(state, playerId, action.x, action.power, false, ctx);
  },

  onTimer(state, timerId, ctx) {
    if (timerId === "settle" && state.phase === "sliding") return settle(state, ctx);
    return { state };
  },

  /** 真ん中あたりから控えめに滑らせる（端まで 40cm ほど手前で止まる強さ） */
  autoAct(state, ctx) {
    const playerId = current(state);
    if (!playerId) return { state };
    const x = 30 + ctx.random() * 40;
    return slide(state, playerId, x, (TABLE_LENGTH - 40 - START_Y) / 2.4, true, ctx);
  },

  tableView(s) {
    return {
      phase: s.phase,
      wobble: WOBBLE[s.wobble],
      turnOrder: turnOrder(s),
      currentPlayerId: current(s),
      glasses: s.glasses,
      shot: s.shot,
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
