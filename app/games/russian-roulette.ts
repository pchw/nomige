import { pick } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export type RussianRouletteConfig = Record<string, never>;

export interface Pick {
  playerId: PlayerId;
  glass: number;
  auto: boolean;
}

export interface RussianRouletteState {
  /** reveal: 溜め / shown: ハズレを見せている（結果画面に移る前） */
  phase: "pick" | "reveal" | "shown" | "done";
  /** ハズレのグラス。開示まではクライアントに送らない */
  poison: number;
  /** グラスごとに選んだ人（未選択は null） */
  pickedBy: (PlayerId | null)[];
  order: PlayerId[];
  /** 手番の人（order のインデックス）。最初の人はランダム */
  turnIndex: number;
  /** 選んだ人数 */
  picks: number;
  lastPick: Pick | null;
}

export type RussianRouletteAction = { type: "pick"; glass: number };

export interface RussianRouletteTableView {
  phase: RussianRouletteState["phase"];
  pickedBy: (PlayerId | null)[];
  order: PlayerId[];
  currentPlayerId: PlayerId | null;
  nextPlayerId: PlayerId | null;
  lastPick: Pick | null;
  /** 開示後（shown 以降）にだけ公開する */
  poison: number | null;
}

export interface RussianRoulettePlayerView {
  isMyTurn: boolean;
}

/** 全員が選び終えてからハズレを開示するまでの溜め */
export const REVEAL_MS = 2500;
/** 結果が出ると結果画面に移るので、その前にハズレを見せておく時間 */
export const SHOW_MS = 2500;

function currentPlayer(s: RussianRouletteState): PlayerId {
  return s.order[(s.turnIndex + s.picks) % s.order.length];
}

function choose(
  state: RussianRouletteState,
  playerId: PlayerId,
  glass: number,
  auto: boolean,
  ctx: Ctx,
): Step<RussianRouletteState> {
  if (state.phase !== "pick") fail("not_picking", "今はグラスを選べません");
  if (currentPlayer(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (!Number.isInteger(glass) || glass < 0 || glass >= state.pickedBy.length)
    fail("invalid_glass", "そのグラスはありません");
  if (state.pickedBy[glass] !== null) fail("already_picked", "そのグラスはもう選ばれています");

  const s = structuredClone(state);
  s.pickedBy[glass] = playerId;
  s.picks++;
  s.lastPick = { playerId, glass, auto };
  const events = [{ name: "roulette.pick", data: s.lastPick }];

  // 残り1つは選ぶ余地がないので、最後の人に自動で配る
  if (s.picks === s.order.length - 1) {
    const last = s.pickedBy.indexOf(null);
    s.pickedBy[last] = currentPlayer(s);
    s.picks++;
  }
  if (s.picks < s.order.length) return { state: s, events };

  s.phase = "reveal";
  return {
    state: s,
    timer: { id: "reveal", at: ctx.now + REVEAL_MS },
    events: [...events, { name: "roulette.drumroll" }],
  };
}

export const russianRoulette: GameDefinition<
  RussianRouletteConfig,
  RussianRouletteState,
  RussianRouletteAction,
  RussianRouletteTableView,
  RussianRoulettePlayerView
> = {
  id: "russian-roulette",
  name: "ロシアンルーレット",
  tagline: "順番にグラスを選ぶ。ハズレを引いた人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: {},
  configFields: [],

  setup(players, _config, ctx) {
    const s: RussianRouletteState = {
      phase: "pick",
      poison: Math.floor(ctx.random() * players.length),
      pickedBy: Array(players.length).fill(null),
      order: players,
      turnIndex: Math.floor(ctx.random() * players.length),
      picks: 0,
      lastPick: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "pick") fail("invalid_action", "不正な操作です");
    return choose(state, playerId, action.glass, false, ctx);
  },

  onTimer(state, timerId, ctx) {
    const loser = state.pickedBy[state.poison]!;
    if (timerId === "reveal" && state.phase === "reveal") {
      const s = structuredClone(state);
      s.phase = "shown";
      return {
        state: s,
        timer: { id: "finish", at: ctx.now + SHOW_MS },
        events: [{ name: "roulette.reveal", data: { poison: s.poison, loser } }],
      };
    }
    if (timerId === "finish" && state.phase === "shown") {
      const s = structuredClone(state);
      s.phase = "done";
      return {
        state: s,
        timer: null,
        result: { losers: [loser], reason: "ハズレのグラスを引いた" },
      };
    }
    return { state };
  },

  autoAct(state, ctx) {
    if (state.phase !== "pick") return { state };
    const free = state.pickedBy.flatMap((p, i) => (p === null ? [i] : []));
    return choose(state, currentPlayer(state), pick(ctx.random, free), true, ctx);
  },

  tableView(s) {
    const picking = s.phase === "pick";
    return {
      phase: s.phase,
      pickedBy: s.pickedBy,
      order: s.order,
      currentPlayerId: picking ? currentPlayer(s) : null,
      nextPlayerId: picking ? s.order[(s.turnIndex + s.picks + 1) % s.order.length] : null,
      lastPick: s.lastPick,
      poison: s.phase === "shown" || s.phase === "done" ? s.poison : null,
    };
  },

  playerView(s, playerId) {
    return { isMyTurn: s.phase === "pick" && currentPlayer(s) === playerId };
  },

  pendingPlayers(s) {
    return s.phase === "pick" ? [currentPlayer(s)] : [];
  },
};
