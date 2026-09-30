import { ANIMALS, type AnimalId } from "./characters";
import { pick, shuffle, tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export interface KabuttaraOutConfig {
  animalCount: "auto" | number;
  spoilers: boolean;
}

export interface KabuttaraReveal {
  round: number;
  picks: Record<PlayerId, AnimalId>;
  collided: PlayerId[];
  exited: PlayerId[];
  retry: boolean;
}

export interface KabuttaraOutState {
  phase: "picking" | "revealing" | "done";
  spoilers: boolean;
  round: number;
  animals: AnimalId[];
  players: PlayerId[];
  remaining: PlayerId[];
  exited: { playerId: PlayerId; round: number }[];
  picks: Record<PlayerId, AnimalId>;
  /** 「今回はおじゃましない」を選んだおじゃま役 */
  skipped: PlayerId[];
  lastReveal: KabuttaraReveal | null;
}

export type KabuttaraOutAction = { type: "pick"; animal: AnimalId } | { type: "skip" };

export interface KabuttaraOutTableView {
  phase: KabuttaraOutState["phase"];
  round: number;
  animals: AnimalId[];
  remaining: PlayerId[];
  exited: KabuttaraOutState["exited"];
  /** 選んだ（またはおじゃましないを選んだ）人 */
  pickedPlayerIds: PlayerId[];
  spoilers: boolean;
  lastReveal: KabuttaraReveal | null;
}

export interface KabuttaraOutPlayerView {
  role: "remaining" | "spoiler" | "watching";
  myPick: AnimalId | null;
  skipped: boolean;
}

const REVEAL_MS = 3500;
const MAX_ROUND = 10;

export function autoAnimalCount(players: number): number {
  return Math.min(ANIMALS.length, Math.max(4, players + 1));
}

function pickers(s: KabuttaraOutState): PlayerId[] {
  return s.spoilers ? s.players : s.remaining;
}

function decided(s: KabuttaraOutState, p: PlayerId): boolean {
  return Boolean(s.picks[p]) || s.skipped.includes(p);
}

/** 残っている人のうち、誰とも被らなかった人 */
export function findUnique(remaining: PlayerId[], picks: Record<PlayerId, AnimalId>): PlayerId[] {
  const counts = new Map<AnimalId, number>();
  for (const a of Object.values(picks)) counts.set(a, (counts.get(a) ?? 0) + 1);
  return remaining.filter((p) => picks[p] && counts.get(picks[p]) === 1);
}

/**
 * 残り2人だけで選ぶと「被る＝2人とも残る」「被らない＝やり直し」で決着がつかない。
 * 片方だけを被らせられるのはおじゃま役だけなので、おじゃま役が選ばないならルーレットで決める。
 */
function stalemateReason(s: KabuttaraOutState, reveal: KabuttaraReveal | null): string | null {
  if (s.remaining.length !== 2) return null;
  if (!s.spoilers) return "残り2人になったのでルーレット";
  // 前の回も2人で、おじゃま役が誰も選ばなかった
  const spoiled = Object.keys(reveal?.picks ?? {}).some((p) => !s.remaining.includes(p));
  if (reveal && reveal.exited.length === 0 && !spoiled) return "おじゃまが入らずルーレット";
  return null;
}

function startPicking(s: KabuttaraOutState): Step<KabuttaraOutState> {
  s.phase = "picking";
  s.picks = {};
  s.skipped = [];
  return { state: s, timer: null };
}

function close(state: KabuttaraOutState, ctx: Ctx): Step<KabuttaraOutState> {
  const s = structuredClone(state);
  const unique = findUnique(s.remaining, s.picks);
  const retry = unique.length === s.remaining.length;
  const exited = retry ? [] : unique;
  const collided = s.remaining.filter((p) => !unique.includes(p));
  s.remaining = s.remaining.filter((p) => !exited.includes(p));
  s.exited.push(...exited.map((playerId) => ({ playerId, round: s.round })));
  s.lastReveal = { round: s.round, picks: s.picks, collided, exited, retry };
  s.phase = "revealing";
  return {
    state: s,
    timer: { id: "reveal", at: ctx.now + REVEAL_MS },
    events: [{ name: "kabuttara.reveal", data: s.lastReveal }],
  };
}

export const kabuttaraOut: GameDefinition<
  KabuttaraOutConfig,
  KabuttaraOutState,
  KabuttaraOutAction,
  KabuttaraOutTableView,
  KabuttaraOutPlayerView
> = {
  id: "kabuttara-out",
  name: "被ったらアウト",
  tagline: "動物を1匹選ぶ。誰とも被らなかった人から抜け、最後の1人が負け",
  minPlayers: 3,
  maxPlayers: 10,
  directHotseat: true,
  defaultConfig: { animalCount: "auto", spoilers: true },
  configFields: [
    {
      key: "animalCount",
      label: "動物の数",
      options: [
        { value: "auto", label: "自動（人数+1）" },
        ...[4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: `${n}匹` })),
      ],
    },
    {
      key: "spoilers",
      label: "おじゃま役（抜けた人も選ぶ）",
      options: [
        { value: true, label: "ON" },
        { value: false, label: "OFF" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const count =
      config.animalCount === "auto" ? autoAnimalCount(players.length) : config.animalCount;
    const animals = shuffle(ctx.random, ANIMALS)
      .slice(0, count)
      .toSorted((a, b) => ANIMALS.indexOf(a) - ANIMALS.indexOf(b));
    const s: KabuttaraOutState = {
      phase: "picking",
      spoilers: config.spoilers,
      round: 1,
      animals,
      players,
      remaining: [...players],
      exited: [],
      picks: {},
      skipped: [],
      lastReveal: null,
    };
    return startPicking(s);
  },

  applyAction(state, playerId, action, ctx) {
    if (state.phase !== "picking") fail("not_picking", "今は選べません");
    if (!pickers(state).includes(playerId)) fail("not_picker", "今回は選べません");
    const s = structuredClone(state);
    if (action.type === "pick") {
      if (!s.animals.includes(action.animal)) fail("invalid_animal", "選択肢にない動物です");
      s.picks[playerId] = action.animal;
      s.skipped = s.skipped.filter((p) => p !== playerId);
    } else if (action.type === "skip") {
      if (s.remaining.includes(playerId)) fail("cannot_skip", "残っている人は選んでください");
      delete s.picks[playerId];
      if (!s.skipped.includes(playerId)) s.skipped.push(playerId);
    } else {
      fail("invalid_action", "不正な操作です");
    }
    if (pickers(s).every((p) => decided(s, p))) return close(s, ctx);
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
          result: { losers: s.remaining, reason: `${s.round}回目まで被り続けた` },
        };
      }
      const reason =
        s.round >= MAX_ROUND ? "決着がつかずルーレット" : stalemateReason(s, state.lastReveal);
      if (reason) {
        s.phase = "done";
        const tb = tieBreak(ctx.random, s.remaining);
        return {
          state: s,
          timer: null,
          result: { losers: [tb.chosen], reason, tieBreak: tb },
        };
      }
      s.round++;
      return startPicking(s);
    }
    return { state };
  },

  autoAct(state, ctx) {
    if (state.phase !== "picking") return { state };
    const s = structuredClone(state);
    for (const p of s.remaining) s.picks[p] ??= pick(ctx.random, s.animals);
    return close(s, ctx);
  },

  tableView(s) {
    return {
      phase: s.phase,
      round: s.round,
      animals: s.animals,
      remaining: s.remaining,
      exited: s.exited,
      pickedPlayerIds: pickers(s).filter((p) => decided(s, p)),
      spoilers: s.spoilers,
      lastReveal: s.lastReveal,
    };
  },

  playerView(s, playerId) {
    const role = s.remaining.includes(playerId) ? "remaining" : s.spoilers ? "spoiler" : "watching";
    const picking = s.phase === "picking";
    return {
      role,
      myPick: picking ? (s.picks[playerId] ?? null) : null,
      skipped: picking && s.skipped.includes(playerId),
    };
  },

  pendingPlayers(s) {
    return s.phase === "picking" ? pickers(s).filter((p) => !decided(s, p)) : [];
  },
};
