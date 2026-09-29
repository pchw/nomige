import { fail, type GameDefinition, type PlayerId, type Step } from "./types";

export interface PoisonChocoConfig {
  size: "small" | "normal" | "large";
}

export interface Bite {
  playerId: PlayerId;
  col: number;
  row: number;
  eaten: number;
  auto: boolean;
}

export interface PoisonChocoState {
  phase: "turn" | "poisoned";
  cols: number;
  rows: number;
  /**
   * 列ごとの残りの高さ（左から。row 0 が一番下で、左下 (0, 0) が毒）。
   * かじると右上がまとめて消えるので、左から右へ高さは増えない。
   */
  heights: number[];
  order: PlayerId[];
  turnIndex: number;
  lastBite: Bite | null;
  log: Bite[];
}

export type PoisonChocoAction = { type: "eat"; col: number; row: number };

export interface PoisonChocoTableView {
  phase: PoisonChocoState["phase"];
  cols: number;
  rows: number;
  heights: number[];
  order: PlayerId[];
  currentPlayerId: PlayerId;
  nextPlayerId: PlayerId;
  lastBite: Bite | null;
  log: Bite[];
  remaining: number;
}

export interface PoisonChocoPlayerView {
  isMyTurn: boolean;
}

export const SIZES: Record<PoisonChocoConfig["size"], { cols: number; rows: number }> = {
  small: { cols: 5, rows: 4 },
  normal: { cols: 6, rows: 5 },
  large: { cols: 7, rows: 6 },
};

export function remaining(heights: number[]): number {
  return heights.reduce((a, b) => a + b, 0);
}

/** (col, row) から右上をかじったときに食べるマスの数 */
export function biteSize(heights: number[], col: number, row: number): number {
  let n = 0;
  for (let c = col; c < heights.length; c++) n += Math.max(0, heights[c] - row);
  return n;
}

export function isPoison(col: number, row: number): boolean {
  return col === 0 && row === 0;
}

function eat(
  state: PoisonChocoState,
  playerId: PlayerId,
  col: number,
  row: number,
  auto: boolean,
): Step<PoisonChocoState> {
  if (state.phase !== "turn") fail("not_playing", "ゲームは終了しています");
  if (state.order[state.turnIndex] !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    col < 0 ||
    col >= state.cols ||
    row < 0 ||
    row >= state.heights[col]
  )
    fail("invalid_cell", "そこにはもうチョコがありません");
  // 毒以外が残っているうちは毒を選べない（自分から負けにいく操作をなくす）
  if (isPoison(col, row) && remaining(state.heights) > 1)
    fail("poison_not_yet", "毒はほかのチョコがなくなってから");

  const s = structuredClone(state);
  const eaten = biteSize(s.heights, col, row);
  for (let c = col; c < s.cols; c++) s.heights[c] = Math.min(s.heights[c], row);
  const bite: Bite = { playerId, col, row, eaten, auto };
  s.lastBite = bite;
  s.log = [...s.log, bite].slice(-10);
  const events = [{ name: "choco.bite", data: bite }];

  if (isPoison(col, row)) {
    s.phase = "poisoned";
    return { state: s, events, result: { losers: [playerId], reason: "毒入りチョコを食べた" } };
  }
  s.turnIndex = (s.turnIndex + 1) % s.order.length;
  return { state: s, events };
}

export const poisonChoco: GameDefinition<
  PoisonChocoConfig,
  PoisonChocoState,
  PoisonChocoAction,
  PoisonChocoTableView,
  PoisonChocoPlayerView
> = {
  id: "poison-choco",
  name: "毒入りチョコ",
  tagline: "板チョコを順番にかじる。左下の毒を食べた人が負け",
  minPlayers: 3,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { size: "normal" },
  configFields: [
    {
      key: "size",
      label: "チョコの大きさ",
      options: [
        { value: "small", label: "小（5×4）" },
        { value: "normal", label: "中（6×5）" },
        { value: "large", label: "大（7×6）" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const { cols, rows } = SIZES[config.size];
    const s: PoisonChocoState = {
      phase: "turn",
      cols,
      rows,
      heights: Array(cols).fill(rows),
      order: players,
      turnIndex: Math.floor(ctx.random() * players.length),
      lastBite: null,
      log: [],
    };
    return { state: s };
  },

  applyAction(state, playerId, action) {
    if (action.type !== "eat") fail("invalid_action", "不正な操作です");
    return eat(state, playerId, action.col, action.row, false);
  },

  onTimer(state) {
    return { state };
  },

  /** 一番右の列のてっぺんを1マスだけかじる（毒しかなければ毒） */
  autoAct(state) {
    if (state.phase !== "turn") return { state };
    const playerId = state.order[state.turnIndex];
    // 高さは右へ増えないので、一番右の列のてっぺんが毒になるのは毒しか残っていないときだけ
    const col = state.heights.findLastIndex((h) => h > 0);
    return eat(state, playerId, col, state.heights[col] - 1, true);
  },

  tableView(s) {
    return {
      phase: s.phase,
      cols: s.cols,
      rows: s.rows,
      heights: s.heights,
      order: s.order,
      currentPlayerId: s.order[s.turnIndex],
      nextPlayerId: s.order[(s.turnIndex + 1) % s.order.length],
      lastBite: s.lastBite,
      log: s.log,
      remaining: remaining(s.heights),
    };
  },

  playerView(s, playerId) {
    return { isMyTurn: s.phase === "turn" && s.order[s.turnIndex] === playerId };
  },

  pendingPlayers(s) {
    return s.phase === "turn" ? [s.order[s.turnIndex]] : [];
  },
};
