import { pick, shuffle } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export type AmidakujiConfig = Record<string, never>;

/** 横線。row 段目で、縦線 gap と gap+1 をつなぐ */
export interface Rung {
  row: number;
  gap: number;
  /** 引いた人。最初から隠れている線は null */
  by: PlayerId | null;
}

export type Move =
  | { kind: "start"; playerId: PlayerId; column: number; auto: boolean }
  | { kind: "line"; playerId: PlayerId; rung: Rung; auto: boolean };

export interface AmidakujiState {
  /**
   * start: スタートの縦線を選ぶ / line: 横線を足す / open: 隠れていた部分を開いた /
   * trace: 1人ずつたどっている / shown: ハズレの人を見せている（結果画面に移る前）
   */
  phase: "start" | "line" | "open" | "trace" | "shown" | "done";
  /** 縦線の数（人数と同じ） */
  columns: number;
  /** 上の見えている段の数。プレイヤーが横線を足せるのはここだけ */
  openRows: number;
  /** 下の隠れている段の数（openRows 段目から下） */
  hiddenRows: number;
  /** 最初から隠れている横線。開くまではクライアントに送らない */
  hidden: Rung[];
  /** プレイヤーが足した横線 */
  added: Rung[];
  /** ハズレの縦線（下端）。最初から見えている */
  hazure: number;
  /** 縦線ごとにスタートに選んだ人 */
  startBy: (PlayerId | null)[];
  order: PlayerId[];
  /** 最初の人（order のインデックス）。スタート選び・横線・たどる順のどれもここから席順 */
  turnIndex: number;
  /** 今のフェーズで操作した人数 */
  turns: number;
  lastMove: Move | null;
  /** たどり終えた人数（たどる順は turnIndex からの席順） */
  traced: number;
}

export type AmidakujiAction =
  | { type: "start"; column: number }
  | { type: "line"; row: number; gap: number };

export interface AmidakujiTableView {
  phase: AmidakujiState["phase"];
  columns: number;
  openRows: number;
  hiddenRows: number;
  /** 開いてから（open 以降）にだけ公開する */
  hidden: Rung[] | null;
  added: Rung[];
  hazure: number;
  startBy: (PlayerId | null)[];
  order: PlayerId[];
  currentPlayerId: PlayerId | null;
  nextPlayerId: PlayerId | null;
  lastMove: Move | null;
  /** たどり終えた人（たどった順）。最後の人は今たどっている最中 */
  traced: PlayerId[];
  /** shown 以降にだけ公開する */
  loser: PlayerId | null;
}

export interface AmidakujiPlayerView {
  isMyTurn: boolean;
}

/** 横線を足せる段の数 */
export const OPEN_ROWS = 5;
/** 隠れた部分の先頭に入れる、見た目のためのランダムな段の数 */
const NOISE_ROWS = 3;
/** 最後の人が横線を引いてから、隠れていた部分を開くまでの溜め */
export const OPEN_MS = 2000;
/** 1人をたどるアニメーションの時間 */
export const TRACE_MS = 1800;
/** 結果が出ると結果画面に移るので、その前にハズレの人を見せておく時間 */
export const SHOW_MS = 2500;

/**
 * start の縦線から下までたどる。返り値は各段に入る前の縦線と、最後に着いた縦線（長さ rows + 1）。
 */
export function trace(rungs: readonly Rung[], rows: number, start: number): number[] {
  const at = new Set(rungs.map((r) => `${r.row}:${r.gap}`));
  const path = [start];
  let c = start;
  for (let row = 0; row < rows; row++) {
    if (at.has(`${row}:${c}`)) c++;
    else if (at.has(`${row}:${c - 1}`)) c--;
    path.push(c);
  }
  return path;
}

/** 見えている段に横線を足せるか（同じ段で隣り合う横線は、どちらに進むか決まらないので引けない） */
export function canPlace(
  s: Pick<AmidakujiState, "columns" | "openRows" | "added">,
  row: number,
  gap: number,
): boolean {
  if (!Number.isInteger(row) || row < 0 || row >= s.openRows) return false;
  if (!Number.isInteger(gap) || gap < 0 || gap >= s.columns - 1) return false;
  return !s.added.some((r) => r.row === row && Math.abs(r.gap - gap) <= 1);
}

function freeSlots(s: AmidakujiState): { row: number; gap: number }[] {
  const slots = [];
  for (let row = 0; row < s.openRows; row++)
    for (let gap = 0; gap < s.columns - 1; gap++)
      if (canPlace(s, row, gap)) slots.push({ row, gap });
  return slots;
}

/**
 * 隠れた部分の横線を作る。
 * 一番下の n 段で、ランダムに選んだ並べ替えを奇偶転置ソートの形で横線にする。
 * 隠れた部分の出口の並びが一様ランダムになるので、上でどこを選んでも、どんな横線を足しても、
 * ハズレに着く確率は全員 1/人数 になる。
 */
function hiddenRungs(n: number, openRows: number, random: () => number): Rung[] {
  const rungs: Rung[] = [];
  for (let i = 0; i < NOISE_ROWS; i++) {
    let prev = -2;
    for (let gap = 0; gap < n - 1; gap++) {
      if (gap - prev > 1 && random() < 0.5) {
        rungs.push({ row: openRows + i, gap, by: null });
        prev = gap;
      }
    }
  }
  const a = shuffle(
    random,
    Array.from({ length: n }, (_, i) => i),
  );
  for (let k = 0; k < n; k++) {
    for (let gap = k % 2; gap < n - 1; gap += 2) {
      if (a[gap] > a[gap + 1]) {
        [a[gap], a[gap + 1]] = [a[gap + 1], a[gap]];
        rungs.push({ row: openRows + NOISE_ROWS + k, gap, by: null });
      }
    }
  }
  return rungs;
}

function totalRows(s: AmidakujiState): number {
  return s.openRows + s.hiddenRows;
}

function currentPlayer(s: AmidakujiState): PlayerId {
  return s.order[(s.turnIndex + s.turns) % s.order.length];
}

/** 次に操作する人。スタート選びの最後の人は自動で配られるので、次は横線の最初の人 */
function nextPlayer(s: AmidakujiState): PlayerId | null {
  const n = s.order.length;
  if (s.phase === "start" && s.turns + 1 >= n - 1) return s.order[s.turnIndex];
  if (s.phase === "line" && s.turns + 1 >= n) return null;
  return s.order[(s.turnIndex + s.turns + 1) % n];
}

function traceOrder(s: AmidakujiState): PlayerId[] {
  return s.order.map((_, i) => s.order[(s.turnIndex + i) % s.order.length]);
}

export function loserOf(s: AmidakujiState): PlayerId {
  const rungs = [...s.added, ...s.hidden];
  const start = s.startBy.findIndex((_, column) => {
    const path = trace(rungs, totalRows(s), column);
    return path[path.length - 1] === s.hazure;
  });
  return s.startBy[start]!;
}

function checkTurn(state: AmidakujiState, playerId: PlayerId, phase: AmidakujiState["phase"]) {
  if (state.phase !== phase)
    fail("wrong_phase", phase === "start" ? "今はスタートを選べません" : "今は横線を引けません");
  if (currentPlayer(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
}

function chooseStart(
  state: AmidakujiState,
  playerId: PlayerId,
  column: number,
  auto: boolean,
): Step<AmidakujiState> {
  checkTurn(state, playerId, "start");
  if (!Number.isInteger(column) || column < 0 || column >= state.columns)
    fail("invalid_column", "その縦線はありません");
  if (state.startBy[column] !== null) fail("already_taken", "その縦線はもう選ばれています");

  const s = structuredClone(state);
  s.startBy[column] = playerId;
  s.turns++;
  s.lastMove = { kind: "start", playerId, column, auto };
  // 残り1本は選ぶ余地がないので、最後の人に自動で配る
  if (s.turns === s.order.length - 1) {
    s.startBy[s.startBy.indexOf(null)] = currentPlayer(s);
    s.turns++;
  }
  if (s.turns === s.order.length) {
    s.phase = "line";
    s.turns = 0;
  }
  return { state: s, events: [{ name: "amidakuji.start", data: { playerId, column, auto } }] };
}

function drawLine(
  state: AmidakujiState,
  playerId: PlayerId,
  row: number,
  gap: number,
  auto: boolean,
  ctx: Ctx,
): Step<AmidakujiState> {
  checkTurn(state, playerId, "line");
  if (!canPlace(state, row, gap)) fail("invalid_line", "そこには横線を引けません");

  const s = structuredClone(state);
  const rung = { row, gap, by: playerId };
  s.added.push(rung);
  s.turns++;
  s.lastMove = { kind: "line", playerId, rung, auto };
  const events = [{ name: "amidakuji.line", data: s.lastMove }];
  if (s.turns < s.order.length) return { state: s, events };

  s.phase = "open";
  return {
    state: s,
    timer: { id: "trace", at: ctx.now + OPEN_MS },
    events: [...events, { name: "amidakuji.drumroll" }],
  };
}

export const amidakuji: GameDefinition<
  AmidakujiConfig,
  AmidakujiState,
  AmidakujiAction,
  AmidakujiTableView,
  AmidakujiPlayerView
> = {
  id: "amidakuji",
  name: "あみだくじ",
  tagline: "縦線を選んで横線を1本ずつ足す。ハズレにたどり着いた人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: {},
  configFields: [],

  setup(players, _config, ctx) {
    const n = players.length;
    const s: AmidakujiState = {
      phase: "start",
      columns: n,
      openRows: OPEN_ROWS,
      hiddenRows: NOISE_ROWS + n,
      hidden: hiddenRungs(n, OPEN_ROWS, ctx.random),
      added: [],
      hazure: Math.floor(ctx.random() * n),
      startBy: Array(n).fill(null),
      order: players,
      turnIndex: Math.floor(ctx.random() * n),
      turns: 0,
      lastMove: null,
      traced: 0,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type === "start") return chooseStart(state, playerId, action.column, false);
    if (action.type === "line")
      return drawLine(state, playerId, action.row, action.gap, false, ctx);
    fail("invalid_action", "不正な操作です");
  },

  onTimer(state, timerId, ctx) {
    const loser = loserOf(state);
    if (timerId === "trace" && (state.phase === "open" || state.phase === "trace")) {
      const s = structuredClone(state);
      s.phase = "trace";
      s.traced++;
      const who = traceOrder(s)[s.traced - 1];
      return {
        state: s,
        // ハズレの人をたどり終えたら、残りの人はたどらずに結果を見せる
        timer: { id: who === loser ? "hit" : "trace", at: ctx.now + TRACE_MS },
        events: [{ name: "amidakuji.trace", data: { playerId: who } }],
      };
    }
    if (timerId === "hit" && state.phase === "trace") {
      const s = structuredClone(state);
      s.phase = "shown";
      return {
        state: s,
        timer: { id: "finish", at: ctx.now + SHOW_MS },
        events: [{ name: "amidakuji.hit", data: { loser } }],
      };
    }
    if (timerId === "finish" && state.phase === "shown") {
      const s = structuredClone(state);
      s.phase = "done";
      return {
        state: s,
        timer: null,
        result: { losers: [loser], reason: "ハズレにたどり着いた" },
      };
    }
    return { state };
  },

  autoAct(state, ctx) {
    if (state.phase === "start") {
      const free = state.startBy.flatMap((p, i) => (p === null ? [i] : []));
      return chooseStart(state, currentPlayer(state), pick(ctx.random, free), true);
    }
    if (state.phase === "line") {
      const slot = pick(ctx.random, freeSlots(state));
      return drawLine(state, currentPlayer(state), slot.row, slot.gap, true, ctx);
    }
    return { state };
  },

  tableView(s) {
    const acting = s.phase === "start" || s.phase === "line";
    const opened = !acting;
    const revealed = s.phase === "shown" || s.phase === "done";
    return {
      phase: s.phase,
      columns: s.columns,
      openRows: s.openRows,
      hiddenRows: s.hiddenRows,
      hidden: opened ? s.hidden : null,
      added: s.added,
      hazure: s.hazure,
      startBy: s.startBy,
      order: s.order,
      currentPlayerId: acting ? currentPlayer(s) : null,
      nextPlayerId: acting ? nextPlayer(s) : null,
      lastMove: s.lastMove,
      traced: traceOrder(s).slice(0, s.traced),
      loser: revealed ? loserOf(s) : null,
    };
  },

  playerView(s, playerId) {
    const acting = s.phase === "start" || s.phase === "line";
    return { isMyTurn: acting && currentPlayer(s) === playerId };
  },

  pendingPlayers(s) {
    return s.phase === "start" || s.phase === "line" ? [currentPlayer(s)] : [];
  },
};
