import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  TRACE_MS,
  canPlace,
  trace,
  type AmidakujiAction,
  type AmidakujiPlayerView,
  type AmidakujiTableView,
  type Rung,
} from "~/games/amidakuji";
import { CHARACTERS } from "~/games/characters";
import { Avatar, PlayerChip } from "../ui";
import type { GameUIProps } from "./types";

type Props = GameUIProps<AmidakujiTableView, AmidakujiPlayerView, AmidakujiAction>;

/** 見えている段（横線を足せる）は指で押しやすいように高くする */
const OPEN_H = 36;
const HIDDEN_H = 18;
/** 幅を測る前（サーバー描画）に使う盤の幅 */
const FALLBACK_W = 320;
/** たどる線を引き終えるまでの時間（次の人に移る前に少し止めて見せる） */
const DRAW_MS = TRACE_MS * 0.85;

export interface LadderPath {
  start: number;
  color: string;
  /** 線を引くアニメーションをする（たどっている最中の人） */
  animate?: boolean;
  /** 線の先を一緒に進むアイコン（animate のときだけ出す） */
  runner?: ReactNode;
}

/** 要素の幅を測る（縦線の間隔を画面幅に合わせるため） */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(FALLBACK_W);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || FALLBACK_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * あみだくじの盤。縦線の上下のラベルは HTML、間の線は SVG で描く。
 * SVG は実際の幅を測ってピクセル単位で描く（伸び縮みさせると、たどる線のアニメーションの長さがずれる）。
 */
export function Ladder({
  columns,
  openRows,
  hiddenRows,
  added,
  hidden,
  top,
  bottom,
  paths = [],
  slots = [],
  onSlot,
  colorOf,
}: {
  columns: number;
  openRows: number;
  hiddenRows: number;
  added: Rung[];
  /** null なら隠れた部分を覆って見せない */
  hidden: Rung[] | null;
  top: ReactNode[];
  bottom: ReactNode[];
  paths?: LadderPath[];
  /** タップできる場所（横線を引ける場所） */
  slots?: { row: number; gap: number }[];
  onSlot?: (row: number, gap: number) => void;
  colorOf?: (rung: Rung) => string;
}) {
  const rows = openRows + hiddenRows;
  const rowTop = (r: number) =>
    r < openRows ? r * OPEN_H : openRows * OPEN_H + (r - openRows) * HIDDEN_H;
  const rowMid = (r: number) => rowTop(r) + (r < openRows ? OPEN_H : HIDDEN_H) / 2;
  const height = rowTop(rows) + 8;
  const [bodyRef, width] = useWidth<HTMLDivElement>();
  const colW = width / columns;
  const x = (c: number) => (c + 0.5) * colW;
  const rungs = [...added, ...(hidden ?? [])];
  const grid = { "--cols": columns } as CSSProperties;

  const pathD = (start: number) => {
    const cols = trace(rungs, rows, start);
    let d = `M ${x(start)} 0`;
    for (let r = 0; r < rows; r++) {
      if (cols[r + 1] !== cols[r])
        d += ` L ${x(cols[r])} ${rowMid(r)} L ${x(cols[r + 1])} ${rowMid(r)}`;
    }
    return `${d} L ${x(cols[rows])} ${height}`;
  };

  return (
    <div className="amida">
      <div className="amida-ends" style={grid}>
        {top.map((node, i) => (
          <div key={i} className="amida-end">
            {node}
          </div>
        ))}
      </div>
      <div ref={bodyRef} className="amida-body" style={{ height }}>
        <svg
          className="amida-svg"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          aria-hidden
        >
          {Array.from({ length: columns }, (_, c) => (
            <line key={c} className="amida-pole" x1={x(c)} x2={x(c)} y1={0} y2={height} />
          ))}
          {slots.map(({ row, gap }) => (
            <line
              key={`g${row}:${gap}`}
              className="amida-guide"
              x1={x(gap)}
              x2={x(gap + 1)}
              y1={rowMid(row)}
              y2={rowMid(row)}
            />
          ))}
          {rungs.map((r) => {
            const pos = { x1: x(r.gap), x2: x(r.gap + 1), y1: rowMid(r.row), y2: rowMid(r.row) };
            // プレイヤーが引いた線は、引いた人の色で縁取りして見分けられるようにする
            return colorOf && r.by ? (
              <g key={`${r.row}:${r.gap}`}>
                <line className="amida-rung amida-rung-edge" {...pos} />
                <line className="amida-rung-fill" {...pos} style={{ stroke: colorOf(r) }} />
              </g>
            ) : (
              <line key={`${r.row}:${r.gap}`} className="amida-rung" {...pos} />
            );
          })}
          {hidden &&
            paths.map((p) => (
              <g
                key={`${p.start}-${p.animate ? "a" : "s"}`}
                className={p.animate ? "amida-path-anim" : "amida-path-done"}
                style={{ "--draw-ms": `${DRAW_MS}ms` } as CSSProperties}
              >
                <path className="amida-path amida-path-edge" d={pathD(p.start)} pathLength={1} />
                <path
                  className="amida-path"
                  d={pathD(p.start)}
                  pathLength={1}
                  style={{ stroke: p.color }}
                />
              </g>
            ))}
          {slots.map(({ row, gap }) => (
            <rect
              key={`s${row}:${gap}`}
              className="amida-slot"
              x={x(gap)}
              width={colW}
              y={rowTop(row)}
              height={OPEN_H}
              onClick={() => onSlot?.(row, gap)}
            />
          ))}
        </svg>
        {hidden &&
          paths
            .filter((p) => p.animate && p.runner)
            .map((p) => (
              <div
                key={`r${p.start}`}
                className="amida-runner"
                style={
                  {
                    offsetPath: `path("${pathD(p.start)}")`,
                    "--draw-ms": `${DRAW_MS}ms`,
                  } as CSSProperties
                }
              >
                {p.runner}
              </div>
            ))}
        <div
          className={`amida-cover ${hidden ? "amida-cover-open" : ""}`}
          style={{ top: rowTop(openRows) }}
        >
          <span>？？？</span>
        </div>
      </div>
      <div className="amida-ends" style={grid}>
        {bottom.map((node, i) => (
          <div key={i} className="amida-end">
            {node}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AmidakujiUI({ table, view, me, players, act }: Props) {
  const myTurn = !!me && !!view?.isMyTurn;
  const current = table.currentPlayerId ? players.get(table.currentPlayerId) : undefined;
  const colorOfPlayer = (id: string | null) => {
    const p = id ? players.get(id) : undefined;
    return p ? CHARACTERS[p.character].color : "var(--white)";
  };
  const rows = table.openRows + table.hiddenRows;
  const rungs = [...table.added, ...(table.hidden ?? [])];

  const lining = myTurn && table.phase === "line";
  const slots: { row: number; gap: number }[] = [];
  if (lining) {
    for (let row = 0; row < table.openRows; row++)
      for (let gap = 0; gap < table.columns - 1; gap++)
        if (canPlace(table, row, gap)) slots.push({ row, gap });
  }

  // たどり終えた人の行き先（最後の人はたどっている最中なので、線を引き終えてから出す）
  const arrived = new Map<number, { id: string; latest: boolean }>();
  if (table.hidden) {
    table.traced.forEach((id, i) => {
      const start = table.startBy.indexOf(id);
      const end = trace(rungs, rows, start)[rows];
      arrived.set(end, { id, latest: i === table.traced.length - 1 && table.phase === "trace" });
    });
  }

  const top = table.startBy.map((id, column) => {
    const p = id ? players.get(id) : undefined;
    const picking = myTurn && table.phase === "start" && id === null;
    return (
      <button
        key={column}
        type="button"
        className={`amida-start ${p ? "amida-start-taken" : ""}`}
        disabled={!picking}
        onClick={() => act({ type: "start", column })}
        aria-label={p ? `${column + 1}番（${p.name}）` : `${column + 1}番`}
      >
        {p ? <Avatar character={p.character} size="sm" /> : column + 1}
      </button>
    );
  });

  const bottom = Array.from({ length: table.columns }, (_, column) => {
    const isHazure = column === table.hazure;
    const who = arrived.get(column);
    const p = who ? players.get(who.id) : undefined;
    const cls = [
      "amida-goal",
      isHazure ? "amida-hazure" : "",
      isHazure && table.loser ? "amida-hit" : "",
    ].join(" ");
    return (
      <span key={column} className={cls}>
        {p ? (
          <span
            className="amida-arrive"
            style={who?.latest ? { animationDelay: `${DRAW_MS}ms` } : undefined}
          >
            <Avatar character={p.character} size="sm" />
          </span>
        ) : isHazure ? (
          "💀"
        ) : (
          "○"
        )}
      </span>
    );
  });

  const lastMove = table.lastMove;
  const tracing = table.traced.at(-1);

  return (
    <div className="game amidakuji">
      <section className="seat-row">
        {table.order.map((id) => (
          <PlayerChip
            key={id}
            player={players.get(id)}
            active={id === table.currentPlayerId}
            dim={!!table.loser && id !== table.loser}
            badge={id === table.nextPlayerId ? "NEXT" : undefined}
          />
        ))}
      </section>

      <section className="turn-banner">
        {(table.phase === "start" || table.phase === "line") && (
          <>
            <strong>{current?.name}</strong> の番：
            {table.phase === "start" ? "スタートを選ぶ" : "横線を1本引く"}
            {lastMove && (
              <span className="muted">
                直前：{players.get(lastMove.playerId)?.name}
                {lastMove.kind === "start"
                  ? ` が ${lastMove.column + 1} 番を選んだ`
                  : " が横線を引いた"}
                {lastMove.auto && "（おまかせ）"}
              </span>
            )}
          </>
        )}
        {table.phase === "open" && <strong>隠れていた横線はこう！</strong>}
        {table.phase === "trace" && tracing && (
          <>
            <strong>{players.get(tracing)?.name}</strong> をたどると…
          </>
        )}
        {table.loser && (
          <>
            <strong>{players.get(table.loser)?.name}</strong> がハズレ！
          </>
        )}
      </section>

      <section className={`panel amida-board ${myTurn ? "hand-active" : ""}`}>
        <Ladder
          columns={table.columns}
          openRows={table.openRows}
          hiddenRows={table.hiddenRows}
          added={table.added}
          hidden={table.hidden}
          top={top}
          bottom={bottom}
          paths={table.traced.map((id, i) => {
            const p = players.get(id);
            return {
              start: table.startBy.indexOf(id),
              color: colorOfPlayer(id),
              animate: i === table.traced.length - 1 && table.phase === "trace",
              runner: p && <Avatar character={p.character} size="sm" />,
            };
          })}
          slots={slots}
          onSlot={(row, gap) => act({ type: "line", row, gap })}
          colorOf={(r) => colorOfPlayer(r.by)}
        />
        {myTurn && table.phase === "start" && (
          <p className="amida-hint">上の番号をタップしてスタートを選ぶ</p>
        )}
        {lining && <p className="amida-hint">点線をタップすると横線が引ける</p>}
        <p className="muted small">
          💀 がハズレ。下の「？？？」には隠れた横線があるので、どこを選んでも確率は同じ
        </p>
      </section>
    </div>
  );
}
