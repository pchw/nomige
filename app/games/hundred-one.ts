import { pick, shuffle } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export type Card =
  | { id: string; kind: "num"; value: number }
  | { id: string; kind: "pm10" }
  | { id: string; kind: "pass" }
  | { id: string; kind: "return" }
  | { id: string; kind: "max" };

export interface Play {
  playerId: PlayerId;
  card: Card;
  delta: number;
  totalAfter: number;
  auto: boolean;
}

export interface HundredOneConfig {
  limit: 101 | 51;
}

export interface HundredOneState {
  phase: "turn" | "busted";
  total: number;
  limit: number;
  deck: Card[];
  discard: Card[];
  hands: Record<PlayerId, Card[]>;
  order: PlayerId[];
  turnIndex: number;
  direction: 1 | -1;
  lastPlay: Play | null;
  log: Play[];
}

export type HundredOneAction = { type: "play"; cardId: string; sign?: 1 | -1 };

export interface HundredOneTableView {
  phase: HundredOneState["phase"];
  total: number;
  limit: number;
  order: PlayerId[];
  currentPlayerId: PlayerId;
  nextPlayerId: PlayerId;
  direction: 1 | -1;
  handCounts: Record<PlayerId, number>;
  lastPlay: Play | null;
  log: Play[];
  revealedHands?: Record<PlayerId, Card[]>;
}

export interface HundredOnePlayerView {
  hand: (Card & { wouldBust: boolean })[];
  isMyTurn: boolean;
  isNext: boolean;
}

const HAND_SIZE = 3;

export function buildDeck(limit: number): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (card: Omit<Card, "id"> & { value?: number }, count: number) => {
    for (let i = 0; i < count; i++) cards.push({ ...card, id: `c${n++}` } as Card);
  };
  for (let v = 1; v <= 10; v++) add({ kind: "num", value: v }, 4);
  if (limit === 101) add({ kind: "num", value: 20 }, 4);
  add({ kind: "pm10" }, 4);
  add({ kind: "return" }, 3);
  add({ kind: "pass" }, 3);
  add({ kind: "max" }, 2);
  return cards;
}

export function applyCard(total: number, limit: number, card: Card, sign: 1 | -1 = 1): number {
  switch (card.kind) {
    case "num":
      return total + card.value;
    case "pm10":
      return Math.max(0, total + 10 * sign);
    case "pass":
    case "return":
      return total;
    case "max":
      return limit;
  }
}

function nextIndex(s: HundredOneState, from = s.turnIndex): number {
  const n = s.order.length;
  return (from + s.direction + n) % n;
}

function draw(s: HundredOneState, random: () => number): Card | undefined {
  if (s.deck.length === 0) {
    s.deck = shuffle(random, s.discard);
    s.discard = [];
  }
  return s.deck.pop();
}

function play(
  state: HundredOneState,
  playerId: PlayerId,
  cardId: string,
  sign: 1 | -1 | undefined,
  auto: boolean,
  ctx: Ctx,
): Step<HundredOneState> {
  const s = structuredClone(state);
  if (s.phase !== "turn") fail("not_playing", "ゲームは終了しています");
  if (s.order[s.turnIndex] !== playerId) fail("not_your_turn", "あなたの番ではありません");
  const hand = s.hands[playerId];
  const index = hand.findIndex((c) => c.id === cardId);
  if (index < 0) fail("invalid_card", "そのカードは持っていません");
  const card = hand[index];
  if (card.kind === "pm10" && sign !== 1 && sign !== -1)
    fail("sign_required", "+10 か -10 を選んでください");

  const before = s.total;
  s.total = applyCard(before, s.limit, card, sign);
  if (card.kind === "return") s.direction = s.direction === 1 ? -1 : 1;
  hand.splice(index, 1);
  s.discard.push(card);
  const played: Play = { playerId, card, delta: s.total - before, totalAfter: s.total, auto };
  s.lastPlay = played;
  s.log = [...s.log, played].slice(-10);
  const events = [{ name: "card.played", data: played }];

  if (s.total > s.limit) {
    s.phase = "busted";
    return {
      state: s,
      events,
      result: { losers: [playerId], reason: `合計 ${s.total} で ${s.limit} を超えた` },
    };
  }

  const drawn = draw(s, ctx.random);
  if (drawn) hand.push(drawn);
  s.turnIndex = nextIndex(s);
  return { state: s, events };
}

export const hundredOne: GameDefinition<
  HundredOneConfig,
  HundredOneState,
  HundredOneAction,
  HundredOneTableView,
  HundredOnePlayerView
> = {
  id: "hundred-one",
  name: "101",
  tagline: "手札を出して合計を増やし、101を超えさせた人が負け",
  minPlayers: 3,
  maxPlayers: 10,
  defaultConfig: { limit: 101 },
  configFields: [
    {
      key: "limit",
      label: "上限値",
      options: [
        { value: 101, label: "101" },
        { value: 51, label: "51（ショート）" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const deck = shuffle(ctx.random, buildDeck(config.limit));
    const hands: Record<PlayerId, Card[]> = {};
    for (const p of players) hands[p] = deck.splice(0, HAND_SIZE);
    const s: HundredOneState = {
      phase: "turn",
      total: 0,
      limit: config.limit,
      deck,
      discard: [],
      hands,
      order: players,
      turnIndex: Math.floor(ctx.random() * players.length),
      direction: 1,
      lastPlay: null,
      log: [],
    };
    return { state: s };
  },

  applyAction(state, playerId, action, ctx) {
    if (action.type !== "play") fail("invalid_action", "不正な操作です");
    return play(state, playerId, action.cardId, action.sign, false, ctx);
  },

  onTimer(state) {
    return { state };
  },

  autoAct(state, ctx) {
    if (state.phase !== "turn") return { state };
    const playerId = state.order[state.turnIndex];
    const card = pick(ctx.random, state.hands[playerId]);
    return play(state, playerId, card.id, card.kind === "pm10" ? -1 : undefined, true, ctx);
  },

  tableView(s) {
    const handCounts: Record<PlayerId, number> = {};
    for (const p of s.order) handCounts[p] = s.hands[p].length;
    return {
      phase: s.phase,
      total: s.total,
      limit: s.limit,
      order: s.order,
      currentPlayerId: s.order[s.turnIndex],
      nextPlayerId: s.order[nextIndex(s)],
      direction: s.direction,
      handCounts,
      lastPlay: s.lastPlay,
      log: s.log,
      revealedHands: s.phase === "busted" ? s.hands : undefined,
    };
  },

  playerView(s, playerId) {
    const hand = s.hands[playerId] ?? [];
    return {
      hand: hand.map((card) => ({
        ...card,
        wouldBust: applyCard(s.total, s.limit, card, -1) > s.limit,
      })),
      isMyTurn: s.phase === "turn" && s.order[s.turnIndex] === playerId,
      isNext: s.phase === "turn" && s.order[nextIndex(s)] === playerId,
    };
  },

  pendingPlayers(s) {
    return s.phase === "turn" ? [s.order[s.turnIndex]] : [];
  },
};
