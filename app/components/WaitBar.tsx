import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "~/games/types";
import { AUTO_ACT_AFTER_MS, type ClientMessage, type GameView } from "~/protocol";
import { useNow, vibrate, type PlayerMap } from "./ui";

interface Props {
  game: GameView;
  players: PlayerMap;
  localIds: PlayerId[];
  send: (msg: ClientMessage) => void;
  serverNow: () => number;
}

const ARM_MS = 5000;

/**
 * 「〇〇さん待ち」の表示と「おまかせで進める」ボタン。
 * 選択を時間で打ち切らない代わりに、誰を待っているかを見せて声をかけやすくし、
 * 誰も操作しない状態が続いたときだけ、代わりに選んで進められるようにする。
 */
export function WaitBar({ game, players, localIds, send, serverNow }: Props) {
  const now = useNow(serverNow, 1000);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = game.pending;
  const myPending = localIds.filter((id) => pending.includes(id));

  // 自分の端末のプレイヤーが新しく「待ち」になったら振動で知らせる
  const prevPending = useRef<PlayerId[]>([]);
  const pendingKey = myPending.join(",");
  useEffect(() => {
    const ids = pendingKey ? pendingKey.split(",") : [];
    if (ids.some((id) => !prevPending.current.includes(id))) vibrate([60, 40, 60]);
    prevPending.current = ids;
  }, [pendingKey, prevPending]);

  useEffect(() => () => clearTimeout(armTimer.current), []);

  if (pending.length === 0) return null;

  // 狼と子豚は、誰が未選択かを出すと延長戦で狼がバレるため人数だけにする
  const hideNames = game.gameId === "wolf-and-pigs";
  const names = pending.map((id) => players.get(id)?.name ?? "?");
  const canAuto = now - game.lastProgressAt >= AUTO_ACT_AFTER_MS;

  const onAuto = () => {
    clearTimeout(armTimer.current);
    if (!armed) {
      setArmed(true);
      armTimer.current = setTimeout(() => setArmed(false), ARM_MS);
      return;
    }
    setArmed(false);
    send({ type: "game.auto" });
  };

  return (
    <section className={`wait-bar ${myPending.length > 0 ? "wait-bar-me" : ""}`}>
      <p className="wait-text">
        {myPending.length > 0 && !hideNames ? (
          <strong>{myPending.map((id) => players.get(id)?.name).join("・")} の番です！</strong>
        ) : hideNames ? (
          <>
            あと <strong>{pending.length}人</strong> の選択待ち
          </>
        ) : (
          <>
            <strong>{names.join("・")}</strong> さん待ち
          </>
        )}
      </p>
      {canAuto && (
        <button
          type="button"
          className={`btn btn-sm ${armed ? "btn-red" : "btn-ink"}`}
          onClick={onAuto}
        >
          {armed ? "本当に？もう一度押すと進みます" : "おまかせで進める"}
        </button>
      )}
    </section>
  );
}
