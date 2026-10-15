import { fullDeck, type PlayingCard } from "./high-low";
import { shuffle, tieBreak } from "./random";
import {
  fail,
  type Ctx,
  type GameDefinition,
  type PlayerId,
  type RoundResult,
  type Step,
} from "./types";

export type NiuniuConfig = Record<string, never>;

export interface Hand {
  cards: PlayingCard[];
  /** 0: ウーニュー（役なし） / 1〜9 / 10: ニューニュー */
  points: number;
  /** 合計が10の倍数になる3枚（cards のインデックス）。ウーニューなら null */
  triple: [number, number, number] | null;
}

export interface SafePlayer {
  playerId: PlayerId;
  points: number;
  /** 何回目の勝負で抜けたか（0: 本戦） */
  runoff: number;
}

export interface NiuniuState {
  /** shown: 全員めくり終えて一番低い人を見せている（結果か延長戦に移る前） */
  phase: "flip" | "shown" | "done";
  /** 今の勝負に参加している人（席順）。延長戦では同点だった人だけ */
  order: PlayerId[];
  /** 最初にめくる人（order のインデックス）。手番は order[(turnIndex + flipped.length) % n] */
  turnIndex: number;
  /** 配られた手札。めくるまではクライアントに送らない */
  hands: Record<PlayerId, Hand>;
  /** めくった人（めくった順） */
  flipped: PlayerId[];
  /** 0: 本戦 / 1〜: 延長戦の回数 */
  runoff: number;
  /** 前の勝負で一番低くならずに抜けた人 */
  safe: SafePlayer[];
  lastFlip: { playerId: PlayerId; auto: boolean } | null;
}

export type NiuniuAction = { type: "flip" };

/** 全員めくったあと、このあとどうなるか */
export type Verdict = "lose" | "runoff" | "roulette";

export interface NiuniuTableView {
  phase: NiuniuState["phase"];
  order: PlayerId[];
  turnIndex: number;
  currentPlayerId: PlayerId | null;
  nextPlayerId: PlayerId | null;
  /** めくった人の手札だけ。まだの人は null */
  hands: Record<PlayerId, Hand | null>;
  flipped: PlayerId[];
  /** shown 以降にだけ入る */
  verdict: Verdict | null;
  runoff: number;
  maxRunoffs: number;
  safe: SafePlayer[];
  lastFlip: NiuniuState["lastFlip"];
}

export interface NiuniuPlayerView {
  isMyTurn: boolean;
}

export const HAND_SIZE = 5;
export const NO_NIU = 0;
export const NIUNIU = 10;
/** 同点で配り直す回数の上限。超えたらルーレット */
export const MAX_RUNOFFS = 3;
/** 最後の人がめくってから、結果画面（または延長戦）に移るまで。めくる演出を見せる */
export const SHOW_MS = 4000;

/** A は 1、2〜10 はそのまま、J・Q・K は 10 と数える */
export function cardValue(card: PlayingCard): number {
  return Math.min(card.rank, 10);
}

/**
 * 合計が10の倍数になる3枚を探し、残り2枚の合計の下一桁を点数にする。
 * 3枚の合計は10の倍数なので、点数はどの3枚を選んでも「5枚の合計の下一桁」と同じになる。
 */
export function evaluate(cards: PlayingCard[]): Hand {
  const v = cards.map(cardValue);
  const total = v.reduce((a, b) => a + b, 0);
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++)
      for (let k = j + 1; k < v.length; k++) {
        if ((v[i] + v[j] + v[k]) % 10 !== 0) continue;
        const rest = total % 10;
        return { cards, points: rest === 0 ? NIUNIU : rest, triple: [i, j, k] };
      }
  return { cards, points: NO_NIU, triple: null };
}

export function pointsLabel(points: number): string {
  if (points === NO_NIU) return "ウーニュー";
  if (points === NIUNIU) return "ニューニュー";
  return `${points}`;
}

function deal(players: PlayerId[], ctx: Ctx): Record<PlayerId, Hand> {
  const deck = shuffle(ctx.random, fullDeck());
  return Object.fromEntries(
    players.map((p, i) => [p, evaluate(deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE))]),
  );
}

function startRound(
  players: PlayerId[],
  runoff: number,
  safe: SafePlayer[],
  ctx: Ctx,
): NiuniuState {
  return {
    phase: "flip",
    order: players,
    turnIndex: Math.floor(ctx.random() * players.length),
    hands: deal(players, ctx),
    flipped: [],
    runoff,
    safe,
    lastFlip: null,
  };
}

function currentPlayer(s: NiuniuState): PlayerId {
  return s.order[(s.turnIndex + s.flipped.length) % s.order.length];
}

function lowestOf(s: NiuniuState, ids: PlayerId[]): PlayerId[] {
  const min = Math.min(...ids.map((p) => s.hands[p].points));
  return ids.filter((p) => s.hands[p].points === min);
}

export function verdictOf(s: NiuniuState): Verdict {
  const lowest = lowestOf(s, s.order);
  if (lowest.length === 1) return "lose";
  return s.runoff < MAX_RUNOFFS ? "runoff" : "roulette";
}

function flip(state: NiuniuState, playerId: PlayerId, auto: boolean, ctx: Ctx): Step<NiuniuState> {
  if (state.phase !== "flip") fail("not_flipping", "今はめくれません");
  if (currentPlayer(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");

  const s = structuredClone(state);
  s.flipped.push(playerId);
  s.lastFlip = { playerId, auto };
  const events = [{ name: "niuniu.flip", data: { playerId, hand: s.hands[playerId] } }];
  if (s.flipped.length < s.order.length) return { state: s, events };

  s.phase = "shown";
  return { state: s, timer: { id: "judge", at: ctx.now + SHOW_MS }, events };
}

/** 一番低い人が1人なら負け。同点なら同点の人だけで配り直し、上限を超えたらルーレット */
function judge(state: NiuniuState, ctx: Ctx): Step<NiuniuState> {
  const lowest = lowestOf(state, state.order);
  const label = pointsLabel(state.hands[lowest[0]].points);
  const verdict = verdictOf(state);

  if (verdict === "runoff") {
    const safe = [
      ...state.safe,
      ...state.order
        .filter((p) => !lowest.includes(p))
        .map((playerId) => ({
          playerId,
          points: state.hands[playerId].points,
          runoff: state.runoff,
        })),
    ];
    return {
      state: startRound(lowest, state.runoff + 1, safe, ctx),
      timer: null,
      events: [{ name: "niuniu.runoff", data: { players: lowest } }],
    };
  }

  const s = structuredClone(state);
  s.phase = "done";
  let result: RoundResult;
  if (verdict === "lose") {
    const why = s.runoff === 0 ? "点数が一番低かった" : "延長戦でも一番低かった";
    result = { losers: lowest, reason: `${why}（${label}）` };
  } else {
    const tb = tieBreak(ctx.random, lowest);
    result = {
      losers: [tb.chosen],
      reason: `延長戦を${MAX_RUNOFFS}回やっても同点（${label}）でルーレット`,
      tieBreak: tb,
    };
  }
  return { state: s, timer: null, result };
}

export const niuniu: GameDefinition<
  NiuniuConfig,
  NiuniuState,
  NiuniuAction,
  NiuniuTableView,
  NiuniuPlayerView
> = {
  id: "niuniu",
  name: "ニューニュー",
  tagline: "5枚めくって、3枚で10の倍数を作れたら残り2枚の下一桁が点数。一番低い人が負け",
  minPlayers: 2,
  // 1組のトランプ（52枚）を5枚ずつ配れる人数
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: {},
  configFields: [],

  setup(players, _config, ctx) {
    return { state: startRound(players, 0, [], ctx) };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "flip") fail("invalid_action", "不正な操作です");
    return flip(state, playerId, false, ctx);
  },

  onTimer(state, timerId, ctx) {
    if (timerId !== "judge" || state.phase !== "shown") return { state };
    return judge(state, ctx);
  },

  autoAct(state, ctx) {
    if (state.phase !== "flip") return { state };
    return flip(state, currentPlayer(state), true, ctx);
  },

  tableView(s) {
    const flipping = s.phase === "flip";
    const n = s.order.length;
    const hands: Record<PlayerId, Hand | null> = {};
    for (const p of s.order) hands[p] = s.flipped.includes(p) ? s.hands[p] : null;
    return {
      phase: s.phase,
      order: s.order,
      turnIndex: s.turnIndex,
      currentPlayerId: flipping ? currentPlayer(s) : null,
      nextPlayerId:
        flipping && s.flipped.length + 1 < n
          ? s.order[(s.turnIndex + s.flipped.length + 1) % n]
          : null,
      hands,
      flipped: s.flipped,
      verdict: flipping ? null : verdictOf(s),
      runoff: s.runoff,
      maxRunoffs: MAX_RUNOFFS,
      safe: s.safe,
      lastFlip: s.lastFlip,
    };
  },

  playerView(s, playerId) {
    return { isMyTurn: s.phase === "flip" && currentPlayer(s) === playerId };
  },

  pendingPlayers(s) {
    return s.phase === "flip" ? [currentPlayer(s)] : [];
  },
};
