import { randInt } from "./random";
import { fail, type GameDefinition, type PlayerId, type Step } from "./types";

export type Face = 1 | 2 | 3 | 4 | 5 | 6;

export interface Bid {
  playerId: PlayerId;
  count: number;
  face: Face;
  auto: boolean;
}

export interface LiarsDiceConfig {
  onesWild: boolean;
  dicePerPlayer: "auto" | 3 | 4 | 5;
  showHint: boolean;
}

export interface Challenge {
  challenger: PlayerId;
  bid: Bid;
  actual: number;
  loser: PlayerId;
}

export interface LiarsDiceState {
  phase: "bidding" | "revealed";
  onesWild: boolean;
  showHint: boolean;
  dice: Record<PlayerId, Face[]>;
  totalDice: number;
  order: PlayerId[];
  turnIndex: number;
  bids: Bid[];
  challenge: Challenge | null;
}

export type LiarsDiceAction = { type: "bid"; count: number; face: Face } | { type: "doubt" };

export interface LiarsDiceTableView {
  phase: LiarsDiceState["phase"];
  order: PlayerId[];
  currentPlayerId: PlayerId;
  totalDice: number;
  diceCounts: Record<PlayerId, number>;
  bids: Bid[];
  onesWild: boolean;
  reveal?: Challenge & { dice: Record<PlayerId, Face[]> };
}

export interface LiarsDicePlayerView {
  myDice: Face[];
  isMyTurn: boolean;
  canDoubt: boolean;
  minBid: { count: number; face: Face } | null;
  hint?: Record<number, number>;
}

export function minFace(onesWild: boolean): Face {
  return onesWild ? 2 : 1;
}

/** 直前の宣言より強い、最小の宣言。吊り上げ不可能なら null */
export function minimumBid(
  prev: { count: number; face: Face } | undefined,
  totalDice: number,
  onesWild: boolean,
): { count: number; face: Face } | null {
  if (!prev) return { count: 1, face: minFace(onesWild) };
  if (prev.face < 6) return { count: prev.count, face: (prev.face + 1) as Face };
  if (prev.count < totalDice) return { count: prev.count + 1, face: minFace(onesWild) };
  return null;
}

export function isStronger(
  next: { count: number; face: Face },
  prev: { count: number; face: Face } | undefined,
): boolean {
  if (!prev) return true;
  return next.count > prev.count || (next.count === prev.count && next.face > prev.face);
}

export function countFace(dice: Record<PlayerId, Face[]>, face: Face, onesWild: boolean): number {
  let n = 0;
  for (const faces of Object.values(dice)) {
    for (const f of faces) if (f === face || (onesWild && f === 1)) n++;
  }
  return n;
}

function current(s: LiarsDiceState): PlayerId {
  return s.order[s.turnIndex];
}

function advance(s: LiarsDiceState): Step<LiarsDiceState> {
  s.turnIndex = (s.turnIndex + 1) % s.order.length;
  return { state: s };
}

function bid(
  state: LiarsDiceState,
  playerId: PlayerId,
  count: number,
  face: Face,
  auto: boolean,
): Step<LiarsDiceState> {
  const s = structuredClone(state);
  if (s.phase !== "bidding") fail("not_playing", "ゲームは終了しています");
  if (current(s) !== playerId) fail("not_your_turn", "あなたの番ではありません");
  if (!Number.isInteger(count) || count < 1 || count > s.totalDice)
    fail("invalid_bid", "個数が不正です");
  if (!Number.isInteger(face) || face < minFace(s.onesWild) || face > 6)
    fail("invalid_bid", "目が不正です");
  if (!isStronger({ count, face }, s.bids.at(-1)))
    fail("weak_bid", "前の宣言より強い宣言をしてください");
  const b: Bid = { playerId, count, face, auto };
  s.bids.push(b);
  const step = advance(s);
  return { ...step, events: [{ name: "dice.bid", data: b }] };
}

function doubt(state: LiarsDiceState, playerId: PlayerId): Step<LiarsDiceState> {
  const s = structuredClone(state);
  if (s.phase !== "bidding") fail("not_playing", "ゲームは終了しています");
  if (current(s) !== playerId) fail("not_your_turn", "あなたの番ではありません");
  const last = s.bids.at(-1);
  if (!last) fail("no_bid", "最初の手番ではダウトできません");
  const actual = countFace(s.dice, last.face, s.onesWild);
  const loser = actual >= last.count ? playerId : last.playerId;
  s.phase = "revealed";
  s.challenge = { challenger: playerId, bid: last, actual, loser };
  return {
    state: s,
    events: [{ name: "dice.reveal", data: s.challenge }],
    result: {
      losers: [loser],
      reason:
        loser === playerId
          ? `ダウト失敗：「${last.face}の目が${last.count}個以上」は本当だった（実際は${actual}個）`
          : `嘘がバレた：「${last.face}の目が${last.count}個以上」に対して実際は${actual}個`,
    },
  };
}

export const liarsDice: GameDefinition<
  LiarsDiceConfig,
  LiarsDiceState,
  LiarsDiceAction,
  LiarsDiceTableView,
  LiarsDicePlayerView
> = {
  id: "liars-dice",
  name: "ライアーダイス",
  tagline: "全員のサイコロの出目を予想して宣言を吊り上げ、嘘だと思ったらダウト",
  minPlayers: 2,
  maxPlayers: 8,
  defaultConfig: { onesWild: true, dicePerPlayer: "auto", showHint: false },
  configFields: [
    {
      key: "onesWild",
      label: "1の目をワイルドにする",
      options: [
        { value: true, label: "ON" },
        { value: false, label: "OFF" },
      ],
    },
    {
      key: "dicePerPlayer",
      label: "1人あたりのサイコロ",
      options: [
        { value: "auto", label: "自動" },
        { value: 3, label: "3個" },
        { value: 4, label: "4個" },
        { value: 5, label: "5個" },
      ],
    },
    {
      key: "showHint",
      label: "期待値のヒント",
      options: [
        { value: false, label: "OFF" },
        { value: true, label: "ON" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const perPlayer =
      config.dicePerPlayer === "auto" ? (players.length <= 5 ? 5 : 3) : config.dicePerPlayer;
    const dice: Record<PlayerId, Face[]> = {};
    for (const p of players) {
      dice[p] = Array.from({ length: perPlayer }, () => randInt(ctx.random, 1, 6) as Face).toSorted(
        (a, b) => a - b,
      );
    }
    const s: LiarsDiceState = {
      phase: "bidding",
      onesWild: config.onesWild,
      showHint: config.showHint,
      dice,
      totalDice: perPlayer * players.length,
      order: players,
      turnIndex: Math.floor(ctx.random() * players.length),
      bids: [],
      challenge: null,
    };
    return { state: s };
  },

  applyAction(state, playerId, action) {
    if (action.type === "bid") return bid(state, playerId, action.count, action.face, false);
    if (action.type === "doubt") return doubt(state, playerId);
    fail("invalid_action", "不正な操作です");
  },

  onTimer(state) {
    return { state };
  },

  autoAct(state) {
    if (state.phase !== "bidding") return { state };
    const playerId = current(state);
    const min = minimumBid(state.bids.at(-1), state.totalDice, state.onesWild);
    if (!min) return doubt(state, playerId);
    return bid(state, playerId, min.count, min.face, true);
  },

  tableView(s) {
    const diceCounts: Record<PlayerId, number> = {};
    for (const p of s.order) diceCounts[p] = s.dice[p].length;
    return {
      phase: s.phase,
      order: s.order,
      currentPlayerId: current(s),
      totalDice: s.totalDice,
      diceCounts,
      bids: s.bids,
      onesWild: s.onesWild,
      reveal: s.challenge ? { ...s.challenge, dice: s.dice } : undefined,
    };
  },

  playerView(s, playerId) {
    const myDice = s.dice[playerId] ?? [];
    const isMyTurn = s.phase === "bidding" && current(s) === playerId;
    let hint: Record<number, number> | undefined;
    if (s.showHint) {
      hint = {};
      const others = s.totalDice - myDice.length;
      const p = s.onesWild ? 1 / 3 : 1 / 6;
      for (let f = minFace(s.onesWild); f <= 6; f++) {
        const mine = myDice.filter((d) => d === f || (s.onesWild && d === 1)).length;
        hint[f] = Math.round((mine + others * p) * 10) / 10;
      }
    }
    return {
      myDice,
      isMyTurn,
      canDoubt: isMyTurn && s.bids.length > 0,
      minBid: minimumBid(s.bids.at(-1), s.totalDice, s.onesWild),
      hint,
    };
  },

  pendingPlayers(s) {
    return s.phase === "bidding" ? [current(s)] : [];
  },
};
