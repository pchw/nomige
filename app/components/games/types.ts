import type { PlayerId } from "~/games/types";
import type { RoomView } from "~/protocol";
import type { PlayerMap } from "../ui";

export interface GameUIProps<TV, PV, A> {
  room: RoomView;
  players: PlayerMap;
  table: TV;
  /** 操作中のプレイヤー。null なら盤面のみ（観戦・ホットシートの目隠し中・結果画面） */
  me: PlayerId | null;
  view: PV | null;
  pending: PlayerId[];
  act: (action: A) => void;
  serverNow: () => number;
}
