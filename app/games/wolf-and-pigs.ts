import { pick, tieBreak } from "./random";
import { fail, type Ctx, type GameDefinition, type PlayerId, type Step } from "./types";

export type House = "straw" | "wood" | "brick";
export const HOUSES: House[] = ["straw", "wood", "brick"];

export interface WolfAndPigsConfig {
  pickSeconds: 10 | 20 | 30;
  runoffMiss: "wolfLoses" | "retry";
}

export interface WolfRound {
  round: number;
  pigPicks: Record<PlayerId, House>;
  attacked: House;
  caught: PlayerId[];
}

export interface WolfAndPigsState {
  phase: "roleCheck" | "picking" | "revealing" | "done";
  pickSeconds: number;
  runoffMiss: WolfAndPigsConfig["runoffMiss"];
  players: PlayerId[];
  wolf: PlayerId;
  round: number;
  pigs: PlayerId[];
  roleChecked: PlayerId[];
  picks: Record<PlayerId, House>;
  /** 延長戦で対象外の人が「見ています」を押したか（共有端末で狼の手番が目立たないようにするため） */
  idled: PlayerId[];
  deadline: number | null;
  history: WolfRound[];
}

export type WolfAndPigsAction =
  | { type: "checkRole" }
  | { type: "pick"; house: House }
  | { type: "idle" };

export interface WolfAndPigsTableView {
  phase: WolfAndPigsState["phase"];
  round: number;
  pigs: PlayerId[];
  checkedCount: number;
  pickedCount: number;
  totalPickers: number;
  deadline: number | null;
  history: WolfRound[];
  wolf?: PlayerId;
}

export interface WolfAndPigsPlayerView {
  role: "wolf" | "pig";
  /** 今回の選択に参加するか（延長戦の対象外の子豚は false） */
  active: boolean;
  myPick: House | null;
  roleChecked: boolean;
  idled: boolean;
}

const ROLE_CHECK_MS = 30_000;
const REVEAL_MS = 4500;
const MAX_ROUND = 10;

function pickers(s: WolfAndPigsState): PlayerId[] {
  return [...s.pigs, s.wolf];
}

function startPicking(s: WolfAndPigsState, now: number): Step<WolfAndPigsState> {
  s.phase = "picking";
  s.picks = {};
  s.idled = [];
  s.deadline = now + s.pickSeconds * 1000;
  return { state: s, timer: { id: "pick", at: s.deadline } };
}

function close(state: WolfAndPigsState, ctx: Ctx): Step<WolfAndPigsState> {
  const s = structuredClone(state);
  for (const p of pickers(s)) s.picks[p] ??= pick(ctx.random, HOUSES);
  const attacked = s.picks[s.wolf];
  const pigPicks: Record<PlayerId, House> = {};
  for (const p of s.pigs) pigPicks[p] = s.picks[p];
  const caught = s.pigs.filter((p) => pigPicks[p] === attacked);
  const round: WolfRound = { round: s.round, pigPicks, attacked, caught };
  s.history.push(round);
  s.phase = "revealing";
  s.deadline = null;
  return {
    state: s,
    timer: { id: "reveal", at: ctx.now + REVEAL_MS },
    events: [{ name: "wolf.reveal", data: round }],
  };
}

const HOUSE_NAME: Record<House, string> = { straw: "わら", wood: "木", brick: "レンガ" };

function afterReveal(state: WolfAndPigsState, ctx: Ctx): Step<WolfAndPigsState> {
  const s = structuredClone(state);
  const last = s.history.at(-1)!;
  const done = (losers: PlayerId[], reason: string, tb?: ReturnType<typeof tieBreak>) => {
    s.phase = "done";
    return { state: s, timer: null, result: { losers, reason, tieBreak: tb } };
  };
  if (last.caught.length === 1) {
    return done(last.caught, `${HOUSE_NAME[last.attacked]}の家で狼に食べられた`);
  }
  if (last.caught.length === 0 && (s.round === 1 || s.runoffMiss === "wolfLoses")) {
    return done([s.wolf], "狼なのに空き家を襲った");
  }
  if (s.round >= MAX_ROUND) {
    const tb = tieBreak(ctx.random, s.pigs);
    return done([tb.chosen], "決着がつかずルーレット", tb);
  }
  if (last.caught.length >= 2) s.pigs = last.caught;
  s.round++;
  return startPicking(s, ctx.now);
}

export const wolfAndPigs: GameDefinition<
  WolfAndPigsConfig,
  WolfAndPigsState,
  WolfAndPigsAction,
  WolfAndPigsTableView,
  WolfAndPigsPlayerView
> = {
  id: "wolf-and-pigs",
  name: "狼と子豚",
  tagline: "わら・木・レンガの家に隠れる。狼が選んだ家にいたら負け。狼が誰かは分からない",
  minPlayers: 3,
  maxPlayers: 10,
  defaultConfig: { pickSeconds: 20, runoffMiss: "wolfLoses" },
  configFields: [
    {
      key: "pickSeconds",
      label: "選択時間",
      options: [
        { value: 10, label: "10秒" },
        { value: 20, label: "20秒" },
        { value: 30, label: "30秒" },
      ],
    },
    {
      key: "runoffMiss",
      label: "延長戦で狼が空振りしたとき",
      options: [
        { value: "wolfLoses", label: "狼の負け" },
        { value: "retry", label: "やり直し" },
      ],
    },
  ],

  setup(players, config, ctx) {
    const wolf = pick(ctx.random, players);
    const s: WolfAndPigsState = {
      phase: "roleCheck",
      pickSeconds: config.pickSeconds,
      runoffMiss: config.runoffMiss,
      players,
      wolf,
      round: 1,
      pigs: players.filter((p) => p !== wolf),
      roleChecked: [],
      picks: {},
      idled: [],
      deadline: ctx.now + ROLE_CHECK_MS,
      history: [],
    };
    return { state: s, timer: { id: "roleCheck", at: s.deadline! } };
  },

  applyAction(state, playerId, action, ctx) {
    if (!state.players.includes(playerId)) fail("not_player", "参加していません");
    const s = structuredClone(state);
    switch (action.type) {
      case "checkRole": {
        if (s.phase !== "roleCheck") fail("invalid_phase", "今は確認できません");
        if (!s.roleChecked.includes(playerId)) s.roleChecked.push(playerId);
        if (s.roleChecked.length === s.players.length) return startPicking(s, ctx.now);
        return { state: s };
      }
      case "pick": {
        if (s.phase !== "picking") fail("invalid_phase", "今は選べません");
        if (!pickers(s).includes(playerId)) fail("not_picker", "今回は選べません");
        if (!HOUSES.includes(action.house)) fail("invalid_house", "その家はありません");
        s.picks[playerId] = action.house;
        if (pickers(s).every((p) => s.picks[p])) return close(s, ctx);
        return { state: s };
      }
      case "idle": {
        if (s.phase !== "picking") fail("invalid_phase", "今は操作できません");
        if (!s.idled.includes(playerId)) s.idled.push(playerId);
        return { state: s };
      }
    }
    fail("invalid_action", "不正な操作です");
  },

  onTimer(state, timerId, ctx) {
    if (timerId === "roleCheck" && state.phase === "roleCheck") {
      return startPicking(structuredClone(state), ctx.now);
    }
    if (timerId === "pick" && state.phase === "picking") return close(state, ctx);
    if (timerId === "reveal" && state.phase === "revealing") return afterReveal(state, ctx);
    return { state };
  },

  tableView(s) {
    return {
      phase: s.phase,
      round: s.round,
      pigs: s.pigs,
      checkedCount: s.roleChecked.length,
      pickedCount: Object.keys(s.picks).length,
      totalPickers: s.pigs.length + 1,
      deadline: s.deadline,
      history: s.history,
      wolf: s.phase === "done" ? s.wolf : undefined,
    };
  },

  playerView(s, playerId) {
    const active = playerId === s.wolf || s.pigs.includes(playerId);
    return {
      role: playerId === s.wolf ? "wolf" : "pig",
      active,
      myPick: s.phase === "picking" ? (s.picks[playerId] ?? null) : null,
      roleChecked: s.roleChecked.includes(playerId),
      idled: s.idled.includes(playerId),
    };
  },

  pendingPlayers(s) {
    if (s.phase === "roleCheck") return s.players.filter((p) => !s.roleChecked.includes(p));
    if (s.phase === "picking") {
      // 延長戦の対象外の人も「見ています」を押すまで pending に含め、狼だけが pending に残る状況を作らない
      return s.players.filter((p) => !s.picks[p] && !s.idled.includes(p));
    }
    return [];
  },
};
