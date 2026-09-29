import { pick, shuffle } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export interface MinesweeperConfig {
  mines: "few" | "normal" | "many";
}

export interface Open {
  playerId: PlayerId;
  cell: number;
  /** 周りの地雷の数。地雷を踏んだら null */
  count: number | null;
  auto: boolean;
}

export interface MinesweeperState {
  phase: "turn" | "boom";
  cols: number;
  rows: number;
  mineCount: number;
  /** 地雷のマス。最初の1マスを開けるまでは決めない（1手目は必ず安全） */
  mines: number[] | null;
  /** 開いたマスの数字（未開封は null） */
  opened: (number | null)[];
  openedBy: (PlayerId | null)[];
  order: PlayerId[];
  turnIndex: number;
  lastOpen: Open | null;
  boomCell: number | null;
}

export type MinesweeperAction = { type: "open"; cell: number };

export interface MinesweeperTableView {
  phase: MinesweeperState["phase"];
  cols: number;
  rows: number;
  mineCount: number;
  opened: (number | null)[];
  openedBy: (PlayerId | null)[];
  order: PlayerId[];
  currentPlayerId: PlayerId;
  nextPlayerId: PlayerId;
  lastOpen: Open | null;
  /** 未開封のうち安全なマスの数（0 なら次は必ず地雷） */
  safeLeft: number;
  /** 爆発後にだけ公開する */
  mines: number[] | null;
  boomCell: number | null;
}

export interface MinesweeperPlayerView {
  isMyTurn: boolean;
}

const COLS = 6;
const MINE_RATIO: Record<MinesweeperConfig["mines"], number> = {
  few: 0.15,
  normal: 0.22,
  many: 0.3,
};

/** 人数が多いときは盤を縦に伸ばして、1〜2周は回るようにする */
export function boardSize(playerCount: number, mines: MinesweeperConfig["mines"]) {
  const rows = playerCount <= 5 ? 6 : 8;
  const cells = COLS * rows;
  return { cols: COLS, rows, mineCount: Math.round(cells * MINE_RATIO[mines]) };
}

export function neighbors(cell: number, cols: number, rows: number): number[] {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push(nr * cols + nc);
    }
  }
  return result;
}

function placeMines(s: MinesweeperState, firstCell: number, random: () => number): number[] {
  const candidates = Array.from({ length: s.cols * s.rows }, (_, i) => i).filter(
    (i) => i !== firstCell,
  );
  return shuffle(random, candidates)
    .slice(0, s.mineCount)
    .toSorted((a, b) => a - b);
}

function safeLeft(s: MinesweeperState): number {
  const unopened = s.opened.filter((v) => v === null).length;
  return unopened - s.mineCount;
}

function open(
  state: MinesweeperState,
  playerId: PlayerId,
  cell: number,
  auto: boolean,
  ctx: Ctx,
): Step<MinesweeperState> {
  if (state.phase !== "turn") fail("not_playing", "ゲームは終了しています");
  if (state.order[state.turnIndex] !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (!Number.isInteger(cell) || cell < 0 || cell >= state.opened.length)
    fail("invalid_cell", "そのマスはありません");
  if (state.opened[cell] !== null) fail("already_open", "そのマスはもう開いています");

  const s = structuredClone(state);
  s.mines ??= placeMines(s, cell, ctx.random);

  if (s.mines.includes(cell)) {
    s.phase = "boom";
    s.boomCell = cell;
    s.openedBy[cell] = playerId;
    s.lastOpen = { playerId, cell, count: null, auto };
    return {
      state: s,
      events: [{ name: "mine.boom", data: s.lastOpen }],
      result: { losers: [playerId], reason: "地雷を踏んだ" },
    };
  }

  const mines = s.mines;
  const count = neighbors(cell, s.cols, s.rows).filter((n) => mines.includes(n)).length;
  s.opened[cell] = count;
  s.openedBy[cell] = playerId;
  s.lastOpen = { playerId, cell, count, auto };
  s.turnIndex = (s.turnIndex + 1) % s.order.length;
  return { state: s, events: [{ name: "mine.open", data: s.lastOpen }] };
}

/** 盤面から確実に安全と分かるマス（0 の隣）。おまかせで使う */
export function obviousSafeCells(s: MinesweeperState): number[] {
  const safe = new Set<number>();
  s.opened.forEach((v, i) => {
    if (v !== 0) return;
    for (const n of neighbors(i, s.cols, s.rows)) if (s.opened[n] === null) safe.add(n);
  });
  return [...safe];
}

export const minesweeper: GameDefinition<
  MinesweeperConfig,
  MinesweeperState,
  MinesweeperAction,
  MinesweeperTableView,
  MinesweeperPlayerView
> = {
  id: "minesweeper",
  name: "地雷原",
  tagline: "順番にマスを1つ開ける。地雷を踏んだ人が負け",
  minPlayers: 3,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { mines: "normal" },
  configFields: [
    {
      key: "mines",
      label: "地雷の数",
      options: [
        { value: "few", label: "少なめ" },
        { value: "normal", label: "ふつう" },
        { value: "many", label: "多め" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const { cols, rows, mineCount } = boardSize(players.length, config.mines);
    const s: MinesweeperState = {
      phase: "turn",
      cols,
      rows,
      mineCount,
      mines: null,
      opened: Array(cols * rows).fill(null),
      openedBy: Array(cols * rows).fill(null),
      order: players,
      turnIndex: Math.floor(ctx.random() * players.length),
      lastOpen: null,
      boomCell: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "open") fail("invalid_action", "不正な操作です");
    return open(state, playerId, action.cell, false, ctx);
  },

  onTimer(state) {
    return { state };
  },

  /** 0 の隣など確実に安全なマスがあればそこを、なければランダムに開ける */
  autoAct(state, ctx) {
    if (state.phase !== "turn") return { state };
    const safe = obviousSafeCells(state);
    const unopened = state.opened.flatMap((v, i) => (v === null ? [i] : []));
    const cell = pick(ctx.random, safe.length > 0 ? safe : unopened);
    return open(state, state.order[state.turnIndex], cell, true, ctx);
  },

  tableView(s) {
    return {
      phase: s.phase,
      cols: s.cols,
      rows: s.rows,
      mineCount: s.mineCount,
      opened: s.opened,
      openedBy: s.openedBy,
      order: s.order,
      currentPlayerId: s.order[s.turnIndex],
      nextPlayerId: s.order[(s.turnIndex + 1) % s.order.length],
      lastOpen: s.lastOpen,
      safeLeft: safeLeft(s),
      mines: s.phase === "boom" ? s.mines : null,
      boomCell: s.boomCell,
    };
  },

  playerView(s, playerId) {
    return { isMyTurn: s.phase === "turn" && s.order[s.turnIndex] === playerId };
  },

  pendingPlayers(s) {
    return s.phase === "turn" ? [s.order[s.turnIndex]] : [];
  },
};
