export type PlayerId = string;

export type GameId =
  | "hundred-one"
  | "liars-dice"
  | "high-low"
  | "kabuttara-out"
  | "wolf-and-pigs"
  | "greedy-dice"
  | "minesweeper"
  | "poison-choco";

export interface Ctx {
  /** サーバー時刻 (ms) */
  now: number;
  /** 0 以上 1 未満の乱数。シード付き PRNG */
  random: () => number;
}

export interface Timer {
  id: string;
  at: number;
}

export interface GameEvent {
  name: string;
  data?: unknown;
}

export interface TieBreak {
  candidates: PlayerId[];
  chosen: PlayerId;
}

export interface RoundResult {
  losers: PlayerId[];
  reason: string;
  tieBreak?: TieBreak;
}

export interface Step<S> {
  state: S;
  /** undefined: 変更なし / null: 解除 / Timer: 設定（ゲームごとにタイマーは同時に1つ） */
  timer?: Timer | null;
  events?: GameEvent[];
  result?: RoundResult;
}

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ConfigField {
  key: string;
  label: string;
  options: { value: string | number | boolean; label: string }[];
}

export interface GameDefinition<C = any, S = any, A = any, TV = any, PV = any> {
  id: GameId;
  name: string;
  /** 一言ルール */
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  /**
   * 隠し情報がなく、全員が見ている前で操作するゲーム。
   * 共有端末でも目隠し画面（ホットシート）を出さず、手番の人がそのまま操作する。
   */
  publicBoard?: boolean;
  defaultConfig: C;
  configFields: ConfigField[];
  setup(players: PlayerId[], config: C, ctx: Ctx): Step<S>;
  /** 不正な操作は GameError を throw する */
  applyAction(state: S, playerId: PlayerId, action: A, ctx: Ctx): Step<S>;
  /** 演出用タイマー（結果公開など）。プレイヤーの選択を時間で打ち切ることはしない */
  onTimer(state: S, timerId: string, ctx: Ctx): Step<S>;
  /** 「おまかせで進める」：待っている人全員の分をアプリが代わりに選んで進める */
  autoAct(state: S, ctx: Ctx): Step<S>;
  tableView(state: S): TV;
  playerView(state: S, playerId: PlayerId): PV;
  /** 今、操作・確認が必要なプレイヤー（ホットシート・「〇〇待ち」表示用） */
  pendingPlayers(state: S): PlayerId[];
}

export function fail(code: string, message: string): never {
  throw new GameError(code, message);
}
