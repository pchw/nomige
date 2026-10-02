import { randInt, tieBreak } from "./random";
import {
  fail,
  type Ctx,
  type GameDefinition,
  type PlayerId,
  type RoundResult,
  type Step,
} from "./types";

export interface HitAndBlowConfig {
  /** 並べるマスの数 */
  slots: 4 | 5 | 6;
}

/** マークの種類（同じマークが何度入ってもよい） */
export const MARKS = ["🍺", "🍷", "🍶", "🥃", "🍸", "🍹"] as const;

export interface Guess {
  playerId: PlayerId;
  marks: number[];
  /** マークも位置も合っている数 */
  hits: number;
  /** マークは答えにあるが位置が違う数 */
  blows: number;
  auto: boolean;
}

export interface HitAndBlowState {
  /** shown: 答えを見せている（結果画面に移る前） */
  phase: "turn" | "shown" | "done";
  slots: number;
  /** 答え。決着まではクライアントに送らない */
  answer: number[];
  /** 全員合わせて予想できる回数。使い切ったら答えを開示して決着 */
  maxGuesses: number;
  guesses: Guess[];
  /** 手番の人が並べている途中のマス（上から埋める） */
  draft: (number | null)[];
  order: PlayerId[];
  /** 最初の人（order のインデックス）。手番は order[(turnIndex + guesses.length) % n] */
  turnIndex: number;
  solvedBy: PlayerId | null;
}

export type HitAndBlowAction =
  | { type: "put"; mark: number }
  | { type: "clear"; slot: number }
  | { type: "guess" };

export interface HitAndBlowTableView {
  phase: HitAndBlowState["phase"];
  slots: number;
  maxGuesses: number;
  guesses: Guess[];
  draft: (number | null)[];
  order: PlayerId[];
  currentPlayerId: PlayerId | null;
  nextPlayerId: PlayerId | null;
  /** 各自の一番良かった予想の点数（まだ予想していなければ null） */
  scores: Record<PlayerId, number | null>;
  solvedBy: PlayerId | null;
  /** 決着後（shown 以降）にだけ公開する */
  answer: number[] | null;
}

export interface HitAndBlowPlayerView {
  isMyTurn: boolean;
}

/** 正解が出たら（予想を使い切ったら）答えを見せてから結果画面に移るまでの時間 */
export const SHOW_MS = 3500;

/** 4マスで12回、1マス増えるごとに2回増やす。推理していれば十分に当たる回数 */
export function maxGuessesFor(slots: number): number {
  return slots * 2 + 4;
}

export function judge(answer: number[], marks: number[]): { hits: number; blows: number } {
  let hits = 0;
  const restAnswer = Array(MARKS.length).fill(0);
  const restGuess = Array(MARKS.length).fill(0);
  for (let i = 0; i < answer.length; i++) {
    if (answer[i] === marks[i]) hits++;
    else {
      restAnswer[answer[i]]++;
      restGuess[marks[i]]++;
    }
  }
  let blows = 0;
  for (let m = 0; m < MARKS.length; m++) blows += Math.min(restAnswer[m], restGuess[m]);
  return { hits, blows };
}

/** 位置も合っているマスを2点、マークだけ合っているマスを1点として数える */
export function scoreOf(g: Pick<Guess, "hits" | "blows">): number {
  return g.hits * 2 + g.blows;
}

export function bestScores(s: HitAndBlowState): Record<PlayerId, number | null> {
  const scores: Record<PlayerId, number | null> = {};
  for (const p of s.order) scores[p] = null;
  for (const g of s.guesses) scores[g.playerId] = Math.max(scores[g.playerId] ?? 0, scoreOf(g));
  return scores;
}

function currentPlayer(s: HitAndBlowState): PlayerId {
  return s.order[(s.turnIndex + s.guesses.length) % s.order.length];
}

function checkTurn(state: HitAndBlowState, playerId: PlayerId) {
  if (state.phase !== "turn") fail("not_turn", "今は予想できません");
  if (currentPlayer(state) !== playerId) fail("not_your_turn", "あなたの番ではありません");
}

/**
 * 正解した人を除き、一番良かった予想の点数が一番低い人が負け。
 * まだ1回も予想していない人は対象外（全員がそうなら、正解者以外の全員が対象）。
 */
export function decideLoser(s: HitAndBlowState, ctx: Ctx): RoundResult {
  const scores = bestScores(s);
  const others = s.order.filter((p) => p !== s.solvedBy);
  const guessed = others.filter((p) => scores[p] !== null);
  const candidates = guessed.length > 0 ? guessed : others;
  const min = Math.min(...candidates.map((p) => scores[p] ?? 0));
  const lowest = candidates.filter((p) => (scores[p] ?? 0) === min);
  const why = s.solvedBy ? "正解から一番遠かった" : "予想を使い切って、正解から一番遠かった";
  if (lowest.length === 1) return { losers: lowest, reason: `${why}（${min}点）` };
  const tb = tieBreak(ctx.random, lowest);
  return { losers: [tb.chosen], reason: `${why}人が同点（${min}点）でルーレット`, tieBreak: tb };
}

function submit(
  state: HitAndBlowState,
  playerId: PlayerId,
  auto: boolean,
  ctx: Ctx,
): Step<HitAndBlowState> {
  const marks = state.draft;
  if (marks.some((m) => m === null)) fail("not_filled", "全部のマスにマークを入れてください");

  const s = structuredClone(state);
  const guess: Guess = {
    playerId,
    marks: marks as number[],
    ...judge(s.answer, marks as number[]),
    auto,
  };
  s.guesses.push(guess);
  s.draft = Array(s.slots).fill(null);
  const events = [{ name: "hb.guess", data: guess }];

  const solved = guess.hits === s.slots;
  if (!solved && s.guesses.length < s.maxGuesses) return { state: s, events };

  s.phase = "shown";
  if (solved) s.solvedBy = playerId;
  return {
    state: s,
    timer: { id: "finish", at: ctx.now + SHOW_MS },
    events: [...events, { name: "hb.reveal", data: { answer: s.answer, solvedBy: s.solvedBy } }],
  };
}

export const hitAndBlow: GameDefinition<
  HitAndBlowConfig,
  HitAndBlowState,
  HitAndBlowAction,
  HitAndBlowTableView,
  HitAndBlowPlayerView
> = {
  id: "hit-and-blow",
  name: "ヒット&ブロー",
  tagline: "隠れたマークの並びを順番に予想する。誰かが当てたとき、一番遠かった人が負け",
  minPlayers: 2,
  maxPlayers: 10,
  publicBoard: true,
  defaultConfig: { slots: 4 },
  configFields: [
    {
      key: "slots",
      label: "マークの数",
      options: [
        { value: 4, label: "4個" },
        { value: 5, label: "5個" },
        { value: 6, label: "6個" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const slots = config.slots;
    const s: HitAndBlowState = {
      phase: "turn",
      slots,
      answer: Array.from({ length: slots }, () => randInt(ctx.random, 0, MARKS.length - 1)),
      maxGuesses: maxGuessesFor(slots),
      guesses: [],
      draft: Array(slots).fill(null),
      order: players,
      turnIndex: Math.floor(ctx.random() * players.length),
      solvedBy: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    checkTurn(state, playerId);
    switch (action.type) {
      case "put": {
        const { mark } = action;
        if (!Number.isInteger(mark) || mark < 0 || mark >= MARKS.length)
          fail("invalid_mark", "そのマークはありません");
        const slot = state.draft.indexOf(null);
        if (slot < 0) fail("full", "もう全部のマスが埋まっています");
        const s = structuredClone(state);
        s.draft[slot] = mark;
        return { state: s };
      }
      case "clear": {
        const { slot } = action;
        if (!Number.isInteger(slot) || slot < 0 || slot >= state.slots)
          fail("invalid_slot", "そのマスはありません");
        const s = structuredClone(state);
        s.draft[slot] = null;
        return { state: s };
      }
      case "guess":
        return submit(state, playerId, false, ctx);
      default:
        fail("invalid_action", "不正な操作です");
    }
  },

  onTimer(state, timerId, ctx) {
    if (timerId !== "finish" || state.phase !== "shown") return { state };
    const s = structuredClone(state);
    s.phase = "done";
    return { state: s, timer: null, result: decideLoser(s, ctx) };
  },

  /** 並べ途中のマスはそのまま使い、空いているマスをランダムに埋めて予想する */
  autoAct(state, ctx) {
    if (state.phase !== "turn") return { state };
    const s = structuredClone(state);
    s.draft = s.draft.map((m) => m ?? randInt(ctx.random, 0, MARKS.length - 1));
    return submit(s, currentPlayer(s), true, ctx);
  },

  tableView(s) {
    const playing = s.phase === "turn";
    return {
      phase: s.phase,
      slots: s.slots,
      maxGuesses: s.maxGuesses,
      guesses: s.guesses,
      draft: s.draft,
      order: s.order,
      currentPlayerId: playing ? currentPlayer(s) : null,
      nextPlayerId: playing ? s.order[(s.turnIndex + s.guesses.length + 1) % s.order.length] : null,
      scores: bestScores(s),
      solvedBy: s.solvedBy,
      answer: playing ? null : s.answer,
    };
  },

  playerView(s, playerId) {
    return { isMyTurn: s.phase === "turn" && currentPlayer(s) === playerId };
  },

  pendingPlayers(s) {
    return s.phase === "turn" ? [currentPlayer(s)] : [];
  },
};
