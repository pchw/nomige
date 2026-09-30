import { pick, shuffle, tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export type Suit = "S" | "H" | "D" | "C";
export interface PlayingCard {
  rank: number;
  suit: Suit;
}

export type Question =
  | { kind: "color" }
  | { kind: "highLow"; base: PlayingCard }
  | { kind: "inOut"; low: number; high: number }
  | { kind: "suit" };

export type Guess = "red" | "black" | "high" | "low" | "in" | "out" | Suit;

export interface HighLowConfig {
  stages: "rideTheBus" | "highLowOnly";
}

export interface Reveal {
  stage: number;
  card: PlayingCard;
  guesses: Record<PlayerId, Guess>;
  correct: PlayerId[];
  wrong: PlayerId[];
  exited: PlayerId[];
}

export interface HighLowState {
  phase: "guessing" | "revealing" | "done";
  stages: HighLowConfig["stages"];
  stage: number;
  deck: PlayingCard[];
  table: PlayingCard[];
  remaining: PlayerId[];
  exited: { playerId: PlayerId; stage: number }[];
  question: Question;
  guesses: Record<PlayerId, Guess>;
  lastReveal: Reveal | null;
}

export type HighLowAction = { type: "guess"; guess: Guess };

export interface HighLowTableView {
  phase: HighLowState["phase"];
  stage: number;
  table: PlayingCard[];
  question: Question;
  remaining: PlayerId[];
  exited: HighLowState["exited"];
  guessedPlayerIds: PlayerId[];
  lastReveal: Reveal | null;
}

export interface HighLowPlayerView {
  inBus: boolean;
  myGuess: Guess | null;
  options: Guess[];
}

const SUITS: Suit[] = ["S", "H", "D", "C"];
const REVEAL_MS = 3500;
const SUIT_ONLY_FROM_STAGE = 15;
const MAX_STAGE = 30;

export function fullDeck(): PlayingCard[] {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit })));
}

export function isRed(card: PlayingCard): boolean {
  return card.suit === "H" || card.suit === "D";
}

export function optionsFor(q: Question): Guess[] {
  switch (q.kind) {
    case "color":
      return ["red", "black"];
    case "highLow":
      return ["high", "low"];
    case "inOut":
      return ["in", "out"];
    case "suit":
      return SUITS;
  }
}

export function isCorrect(q: Question, guess: Guess, card: PlayingCard): boolean {
  switch (q.kind) {
    case "color":
      return guess === (isRed(card) ? "red" : "black");
    case "highLow":
      if (card.rank === q.base.rank) return false;
      return guess === (card.rank > q.base.rank ? "high" : "low");
    case "inOut":
      if (card.rank === q.low || card.rank === q.high) return false;
      return guess === (card.rank > q.low && card.rank < q.high ? "in" : "out");
    case "suit":
      return guess === card.suit;
  }
}

function questionFor(s: HighLowState): Question {
  const last = s.table.at(-1)!;
  if (s.stage >= SUIT_ONLY_FROM_STAGE) return { kind: "suit" };
  if (s.stages === "highLowOnly") return { kind: "highLow", base: last };
  switch (s.stage) {
    case 1:
      return { kind: "color" };
    case 2:
      return { kind: "highLow", base: s.table[0] };
    case 3: {
      const a = s.table[0].rank;
      const b = s.table[1].rank;
      return { kind: "inOut", low: Math.min(a, b), high: Math.max(a, b) };
    }
    case 4:
      return { kind: "suit" };
    default:
      return { kind: "highLow", base: last };
  }
}

function startGuessing(s: HighLowState): Step<HighLowState> {
  s.phase = "guessing";
  s.guesses = {};
  s.question = questionFor(s);
  return { state: s, timer: null };
}

function drawCard(s: HighLowState, ctx: Ctx): PlayingCard {
  if (s.deck.length === 0) s.deck = shuffle(ctx.random, fullDeck());
  return s.deck.pop()!;
}

function close(state: HighLowState, ctx: Ctx): Step<HighLowState> {
  const s = structuredClone(state);
  const card = drawCard(s, ctx);
  s.table.push(card);
  const correct: PlayerId[] = [];
  const wrong: PlayerId[] = [];
  for (const p of s.remaining) {
    const g = s.guesses[p];
    (g && isCorrect(s.question, g, card) ? correct : wrong).push(p);
  }
  const exited = correct.length > 0 && wrong.length > 0 ? correct : [];
  s.remaining = s.remaining.filter((p) => !exited.includes(p));
  s.exited.push(...exited.map((playerId) => ({ playerId, stage: s.stage })));
  s.lastReveal = { stage: s.stage, card, guesses: s.guesses, correct, wrong, exited };
  s.phase = "revealing";
  return {
    state: s,
    timer: { id: "reveal", at: ctx.now + REVEAL_MS },
    events: [{ name: "highlow.reveal", data: s.lastReveal }],
  };
}

export const highLow: GameDefinition<
  HighLowConfig,
  HighLowState,
  HighLowAction,
  HighLowTableView,
  HighLowPlayerView
> = {
  id: "high-low",
  name: "ハイロー",
  tagline: "次のカードを全員で予想。当てた人から抜け、最後の1人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  defaultConfig: { stages: "rideTheBus" },
  configFields: [
    {
      key: "stages",
      label: "ステージ構成",
      options: [
        { value: "rideTheBus", label: "ライド・ザ・バス" },
        { value: "highLowOnly", label: "上か下かのみ" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const deck = shuffle(ctx.random, fullDeck());
    const s: HighLowState = {
      phase: "guessing",
      stages: config.stages,
      stage: 1,
      deck,
      table: [],
      remaining: [...players],
      exited: [],
      question: { kind: "color" },
      guesses: {},
      lastReveal: null,
    };
    // 上か下かのみの場合は基準となる1枚を最初にめくっておく
    if (config.stages === "highLowOnly") s.table.push(s.deck.pop()!);
    return startGuessing(s);
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "guess") fail("invalid_action", "不正な操作です");
    if (state.phase !== "guessing") fail("not_guessing", "今は予想できません");
    if (!state.remaining.includes(playerId)) fail("not_in_bus", "もうバスを降りています");
    if (!optionsFor(state.question).includes(action.guess))
      fail("invalid_guess", "選択肢にない予想です");
    const s = structuredClone(state);
    s.guesses[playerId] = action.guess;
    if (s.remaining.every((p) => s.guesses[p])) return close(s, ctx);
    return { state: s };
  },

  onTimer(state, timerId, ctx) {
    if (timerId === "reveal" && state.phase === "revealing") {
      const s = structuredClone(state);
      if (s.remaining.length === 1) {
        s.phase = "done";
        return {
          state: s,
          timer: null,
          result: { losers: s.remaining, reason: `ステージ${s.stage}までバスを降りられなかった` },
        };
      }
      if (s.stage >= MAX_STAGE) {
        s.phase = "done";
        const tb = tieBreak(ctx.random, s.remaining);
        return {
          state: s,
          timer: null,
          result: { losers: [tb.chosen], reason: "決着がつかずルーレット", tieBreak: tb },
        };
      }
      s.stage++;
      return startGuessing(s);
    }
    return { state };
  },

  autoAct(state, ctx) {
    if (state.phase !== "guessing") return { state };
    const s = structuredClone(state);
    const options = optionsFor(s.question);
    for (const p of s.remaining) s.guesses[p] ??= pick(ctx.random, options);
    return close(s, ctx);
  },

  tableView(s) {
    return {
      phase: s.phase,
      stage: s.stage,
      table: s.table,
      question: s.question,
      remaining: s.remaining,
      exited: s.exited,
      guessedPlayerIds: Object.keys(s.guesses),
      lastReveal: s.lastReveal,
    };
  },

  playerView(s, playerId) {
    return {
      inBus: s.remaining.includes(playerId),
      myGuess: s.phase === "guessing" ? (s.guesses[playerId] ?? null) : null,
      options: optionsFor(s.question),
    };
  },

  pendingPlayers(s) {
    return s.phase === "guessing" ? s.remaining.filter((p) => !s.guesses[p]) : [];
  },
};
