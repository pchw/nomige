import { useEffect, useState, type ReactNode } from "react";
import { CHARACTERS, type CharacterId } from "~/games/characters";
import type { PlayerId } from "~/games/types";
import type { PlayerInfo } from "~/protocol";

export type PlayerMap = Map<PlayerId, PlayerInfo>;

export function Avatar({
  character,
  size = "md",
}: {
  character: CharacterId;
  size?: "sm" | "md" | "lg";
}) {
  const c = CHARACTERS[character];
  return (
    <span className={`avatar avatar-${size}`} style={{ background: c.color }} aria-hidden>
      {c.emoji}
    </span>
  );
}

export function PlayerChip({
  player,
  active,
  dim,
  badge,
}: {
  player: PlayerInfo | undefined;
  active?: boolean;
  dim?: boolean;
  badge?: ReactNode;
}) {
  if (!player) return null;
  return (
    <span className={`chip ${active ? "chip-active" : ""} ${dim ? "chip-dim" : ""}`}>
      <Avatar character={player.character} size="sm" />
      <span className="chip-name">{player.name}</span>
      {badge && <span className="chip-badge">{badge}</span>}
    </span>
  );
}

export function useNow(serverNow: () => number, intervalMs = 200): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [serverNow, intervalMs]);
  return now;
}

export function Countdown({
  deadline,
  total,
  serverNow,
}: {
  deadline: number | null;
  total: number;
  serverNow: () => number;
}) {
  const now = useNow(serverNow, 100);
  if (!deadline) return null;
  const left = Math.max(0, deadline - now);
  const ratio = Math.min(1, left / (total * 1000));
  return (
    <div className={`countdown ${left < 3000 ? "countdown-hurry" : ""}`}>
      <span className="countdown-num">{Math.ceil(left / 1000)}</span>
      <span className="countdown-bar">
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
    </div>
  );
}

/** 押している間だけ中身を見せる（周りから覗かれにくくする） */
export function HoldReveal({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={`hold ${open ? "hold-open" : ""}`}
      onPointerDown={() => setOpen(true)}
      onPointerUp={() => setOpen(false)}
      onPointerLeave={() => setOpen(false)}
      onPointerCancel={() => setOpen(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {open ? children : <span className="hold-label">👆 {label}</span>}
    </button>
  );
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // 非対応端末
  }
}
