/**
 * 上から見た2次元の簡単な物理計算（グラスすべらせ・ボウリングで共通）。
 * 摩擦による一定の減速と、円どうしの衝突だけを扱う。
 * サーバーで1回だけ計算して軌跡を全端末に配るので、端末ごとの計算のずれは気にしなくてよい。
 */

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 重さ（衝突の跳ね返り方に使う） */
  m: number;
  /** 減速度（単位/s²） */
  friction: number;
  /** 場外に出たもの。他と当たらずに滑り続ける */
  out: boolean;
}

export interface SimulateOptions {
  /** 場外の判定 */
  isOut: (b: Body) => boolean;
  restitution: number;
  /** 動かした後に毎回呼ぶ（壁で止める・溝に沿わせるなど） */
  constrain?: (b: Body) => void;
  /** 最長の計算時間（秒） */
  maxSeconds?: number;
}

const DT = 1 / 120;
const FRAME_EVERY = 4;
/** 軌跡を記録する間隔（30fps） */
export const FRAME_MS = DT * FRAME_EVERY * 1000;

/**
 * 開始からの経過時間に対応する軌跡の1コマ。
 * 端末の時計は少しずれるので、開始前（負の経過時間）や終了後でも必ずどれかのコマを返す。
 */
export function frameAt(frames: number[][], elapsedMs: number): number[] {
  return frames[frameIndexAt(frames, elapsedMs)];
}

export function frameIndexAt(frames: number[][], elapsedMs: number): number {
  const i = Math.floor(elapsedMs / FRAME_MS);
  return Math.min(frames.length - 1, Math.max(0, Number.isFinite(i) ? i : 0));
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function body(props: Pick<Body, "x" | "y" | "r" | "m" | "friction"> & Partial<Body>): Body {
  return { vx: 0, vy: 0, out: false, ...props };
}

/** 全部止まるまで動かし、軌跡を返す。frames[i] = bodies の順に [x0, y0, x1, y1, ...] */
export function simulate(bodies: Body[], options: SimulateOptions): number[][] {
  const frames: number[][] = [];
  const record = () => frames.push(bodies.flatMap((b) => [round1(b.x), round1(b.y)]));
  record();
  const maxSteps = Math.round((options.maxSeconds ?? 8) / DT);
  for (let step = 1; step <= maxSteps; step++) {
    let moving = false;
    for (const b of bodies) {
      const speed = Math.hypot(b.vx, b.vy);
      if (speed === 0) continue;
      const dec = b.friction * DT;
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
      options.constrain?.(b);
      if (!b.out && options.isOut(b)) b.out = true;
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++)
        collide(bodies[i], bodies[j], options.restitution);
    }
    if (step % FRAME_EVERY === 0 || !moving) record();
    if (!moving) break;
  }
  return frames;
}

function collide(a: Body, b: Body, restitution: number) {
  if (a.out || b.out) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min || dist === 0) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const ia = 1 / a.m;
  const ib = 1 / b.m;
  // 近づいているときだけ跳ね返す
  const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (approach > 0) {
    const j = ((1 + restitution) * approach) / (ia + ib);
    a.vx -= j * ia * nx;
    a.vy -= j * ia * ny;
    b.vx += j * ib * nx;
    b.vy += j * ib * ny;
  }
  // めり込みを重さの逆比で押し戻す
  const push = (min - dist) / (ia + ib);
  a.x -= nx * push * ia;
  a.y -= ny * push * ia;
  b.x += nx * push * ib;
  b.y += ny * push * ib;
}
