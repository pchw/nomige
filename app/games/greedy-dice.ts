import { randInt, tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export type Face = 1 | 2 | 3 | 4 | 5 | 6;

export interface GreedyDiceConfig {
  dice: 1 | 2;
}

export interface Turn {
  playerId: PlayerId;
  rolls: Face[][];
  /** stop: 止めて確定 / bust: 1が出て0点 */
  end: "stop" | "bust";
  score: number;
  auto: boolean;
}

export interface GreedyDiceState {
  phase: "turn" | "done";
  dice: 1 | 2;
  order: PlayerId[];
  /** 手番の順番（order の添字）。開始プレイヤーから1周する */
  turnIndex: number;
  startIndex: number;
  /** 手番を終えた人の確定点 */
  scores: Record<PlayerId, number>;
  /** 手番中の人の出目と点 */
  rolls: Face[][];
  turnTotal: number;
  lastTurn: Turn | null;
}

export type GreedyDiceAction = { type: "roll" } | { type: "stop" };

export interface GreedyDiceTableView {
  phase: GreedyDiceState["phase"];
  dice: 1 | 2;
  /** 手番順に並べたプレイヤー */
  turnOrder: PlayerId[];
  currentPlayerId: PlayerId | null;
  scores: Record<PlayerId, number>;
  rolls: Face[][];
  turnTotal: number;
  lastTurn: Turn | null;
  /** 手番を終えた人の中の最低点（まだ誰も終えていなければ null） */
  lowest: number | null;
}

export interface GreedyDicePlayerView {
  isMyTurn: boolean;
  canStop: boolean;
}

function turnOrder(s: GreedyDiceState): PlayerId[] {
  const n = s.order.length;
  return Array.from({ length: n }, (_, i) => s.order[(s.startIndex + i) % n]);
}

function current(s: GreedyDiceState): PlayerId | null {
  return s.phase === "turn" ? turnOrder(s)[s.turnIndex] : null;
}

function lowestScore(s: GreedyDiceState): number | null {
  const values = Object.values(s.scores);
  return values.length > 0 ? Math.min(...values) : null;
}

function endTurn(
  s: GreedyDiceState,
  end: Turn["end"],
  auto: boolean,
  ctx: Ctx,
): Step<GreedyDiceState> {
  const playerId = current(s)!;
  const score = end === "stop" ? s.turnTotal : 0;
  s.scores[playerId] = score;
  s.lastTurn = { playerId, rolls: s.rolls, end, score, auto };
  s.rolls = [];
  s.turnTotal = 0;
  const events = [{ name: "greedy.turnEnd", data: s.lastTurn }];

  if (s.turnIndex < s.order.length - 1) {
    s.turnIndex++;
    return { state: s, events };
  }

  s.phase = "done";
  const min = lowestScore(s)!;
  const losers = s.order.filter((p) => s.scores[p] === min);
  if (losers.length === 1) {
    return { state: s, events, result: { losers, reason: `${min}点で最下位` } };
  }
  const tb = tieBreak(ctx.random, losers);
  return {
    state: s,
    events,
    result: { losers: [tb.chosen], reason: `${min}点で同点の最下位からルーレット`, tieBreak: tb },
  };
}

function roll(state: GreedyDiceState, auto: boolean, ctx: Ctx): Step<GreedyDiceState> {
  const s = structuredClone(state);
  const faces = Array.from({ length: s.dice }, () => randInt(ctx.random, 1, 6) as Face);
  s.rolls.push(faces);
  if (faces.includes(1)) return endTurn(s, "bust", auto, ctx);
  s.turnTotal += faces.reduce((a, b) => a + b, 0);
  return { state: s, events: [{ name: "greedy.roll", data: faces }] };
}

function stop(state: GreedyDiceState, auto: boolean, ctx: Ctx): Step<GreedyDiceState> {
  if (state.rolls.length === 0) fail("roll_first", "まず1回は振ってください");
  return endTurn(structuredClone(state), "stop", auto, ctx);
}

export const greedyDice: GameDefinition<
  GreedyDiceConfig,
  GreedyDiceState,
  GreedyDiceAction,
  GreedyDiceTableView,
  GreedyDicePlayerView
> = {
  id: "greedy-dice",
  name: "欲張りサイコロ",
  tagline: "好きなだけ振って点を貯める。1が出たら0点。一番低い人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { dice: 1 },
  configFields: [
    {
      key: "dice",
      label: "サイコロの数",
      options: [
        { value: 1, label: "1個" },
        { value: 2, label: "2個（どちらかが1ならアウト）" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const s: GreedyDiceState = {
      phase: "turn",
      dice: config.dice,
      order: players,
      turnIndex: 0,
      startIndex: Math.floor(ctx.random() * players.length),
      scores: {},
      rolls: [],
      turnTotal: 0,
      lastTurn: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (state.phase !== "turn") fail("not_playing", "ゲームは終了しています");
    if (current(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
    switch (action.type) {
      case "roll":
        return roll(state, false, ctx);
      case "stop":
        return stop(state, false, ctx);
      default:
        fail("invalid_action", "不正な操作です");
    }
  },

  onTimer(state) {
    return { state };
  },

  /** 1回も振っていなければ1回振る。振っていればそこで止める */
  autoAct(state, ctx) {
    if (state.phase !== "turn") return { state };
    return state.rolls.length === 0 ? roll(state, true, ctx) : stop(state, true, ctx);
  },

  tableView(s) {
    return {
      phase: s.phase,
      dice: s.dice,
      turnOrder: turnOrder(s),
      currentPlayerId: current(s),
      scores: s.scores,
      rolls: s.rolls,
      turnTotal: s.turnTotal,
      lastTurn: s.lastTurn,
      lowest: lowestScore(s),
    };
  },

  playerView(s, playerId) {
    const isMyTurn = current(s) === playerId;
    return { isMyTurn, canStop: isMyTurn && s.rolls.length > 0 };
  },

  pendingPlayers(s) {
    const p = current(s);
    return p ? [p] : [];
  },
};
