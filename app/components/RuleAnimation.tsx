import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { AnimalId } from "~/games/characters";
import type { GameId } from "~/games/types";
import { Trump } from "./games/HighLowUI";
import { PlayingCardView } from "./games/HundredOneUI";
import { Die } from "./games/LiarsDiceUI";
import { Avatar } from "./ui";

/**
 * ルールを「動く絵＋一言」のコマ送りで見せる。
 * 酔っていても文章を読まずに流れが分かることを優先し、各コマの一言は短くする。
 */

interface Scene {
  caption: string;
  sub?: string;
  body: ReactNode;
}

type Config = Record<string, unknown>;

const SCENE_MS = 3600;

/** アニメーションの開始を遅らせる */
const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Bubble({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`ra-bubble ${tone ?? ""}`} style={style}>
      {children}
    </span>
  );
}

function Who({ c, label }: { c: AnimalId; label?: string }) {
  return (
    <span className="ra-who">
      <Avatar character={c} size="md" />
      {label && <span className="ra-who-label">{label}</span>}
    </span>
  );
}

const PEOPLE: AnimalId[] = ["cat", "dog", "rabbit", "bear"];

const card = (id: string, value: number) => ({ id, kind: "num" as const, value });

function hundredOneScenes(config: Config): Scene[] {
  const L = config.limit === 51 ? 51 : 101;
  return [
    {
      caption: "手札から1枚出す",
      sub: "順番に1人1枚",
      body: (
        <div className="ra-col">
          <div className="ra-total">合計 {L - 14}</div>
          <div className="ra-row ra-hand">
            <PlayingCardView card={card("a", 3)} limit={L} small />
            <span className="ra-play-up">
              <PlayingCardView card={card("b", 7)} limit={L} />
            </span>
            <PlayingCardView card={{ id: "c", kind: "pass" }} limit={L} small />
          </div>
        </div>
      ),
    },
    {
      caption: "出した数だけ合計が増える",
      body: (
        <div className="ra-row">
          <PlayingCardView card={card("b", 7)} limit={L} />
          <span className="ra-arrow">→</span>
          <span className="ra-total ra-swap">
            <span className="ra-swap-old">{L - 14}</span>
            <span className="ra-swap-new">{L - 7}</span>
          </span>
        </div>
      ),
    },
    {
      caption: `${L} を超えたら負け！`,
      sub: `ちょうど ${L} はセーフ`,
      body: (
        <div className="ra-row">
          <span className="ra-total">{L - 3}</span>
          <span className="ra-pop" style={delay(0.4)}>
            ＋<PlayingCardView card={card("d", 7)} limit={L} small />
          </span>
          <span className="ra-total ra-bust ra-pop" style={delay(1.2)}>
            {L + 4}
          </span>
          <span className="ra-beer ra-pop" style={delay(1.8)}>
            アウト🍺
          </span>
        </div>
      ),
    },
    {
      caption: "特殊カードで押し付けろ",
      sub: "±10・パス・逆回り・一気に上限",
      body: (
        <div className="ra-row ra-cards-fit">
          {[
            { id: "p", kind: "pm10" as const },
            { id: "s", kind: "pass" as const },
            { id: "r", kind: "return" as const },
            { id: "m", kind: "max" as const },
          ].map((c, i) => (
            <span key={c.id} className="ra-pop" style={delay(0.3 + i * 0.45)}>
              <PlayingCardView card={c} limit={L} />
            </span>
          ))}
        </div>
      ),
    },
  ];
}

function liarsDiceScenes(config: Config): Scene[] {
  const wild = config.onesWild !== false;
  const all: (1 | 2 | 3 | 4 | 5 | 6)[][] = [
    [5, 1, 3, 5, 2],
    [6, 5, 1, 4, 2],
    [5, 3, 6, 5, 1],
  ];
  const isHit = (f: number) => f === 5 || (wild && f === 1);
  let order = 0;
  return [
    {
      caption: "自分のサイコロだけ見える",
      body: (
        <div className="ra-col">
          <div className="ra-row">
            {[0, 1].map((i) => (
              <span key={i} className="ra-hidden-dice">
                ？？？
              </span>
            ))}
          </div>
          <div className="ra-row ra-pop">
            {all[0].map((f, i) => (
              <Die key={i} face={f} />
            ))}
          </div>
          <span className="ra-tag">あなた</span>
        </div>
      ),
    },
    {
      caption: "全員分でいくつあるか宣言",
      sub: "嘘をついてもOK",
      body: (
        <div className="ra-row">
          <Who c="cat" />
          <Bubble style={delay(0.3)}>
            <Die face={5} small /> が <b>6個</b> 以上！
          </Bubble>
        </div>
      ),
    },
    {
      caption: "次の人は吊り上げるか…",
      sub: "…嘘だと思ったらダウト！",
      body: (
        <div className="ra-col">
          <div className="ra-row">
            <Who c="dog" />
            <Bubble style={delay(0.2)}>
              <Die face={5} small /> が <b>7個</b> 以上！
            </Bubble>
          </div>
          <div className="ra-row">
            <Who c="rabbit" />
            <Bubble tone="ra-bubble-red" style={delay(1.4)}>
              ダウト！
            </Bubble>
          </div>
        </div>
      ),
    },
    {
      caption: "全員のサイコロを数える",
      sub: wild ? "1 はどの目にも数える" : undefined,
      body: (
        <div className="ra-col">
          {all.map((faces, p) => (
            <div key={p} className="ra-row ra-row-tight">
              {faces.map((f, i) => {
                const hit = isHit(f);
                const d = hit ? 0.3 + order++ * 0.3 : 0;
                return (
                  <span key={i} className={hit ? "ra-hit" : ""} style={hit ? delay(d) : undefined}>
                    <Die face={f} small />
                  </span>
                );
              })}
            </div>
          ))}
          <span className="ra-tag ra-pop" style={delay(0.3 + order * 0.3)}>
            {wild ? "7個あった！" : "5個しかない！"}
          </span>
        </div>
      ),
    },
    {
      caption: "外した方の負け",
      body: (
        <div className="ra-col">
          <div className="ra-row">
            <span className="ra-tag">宣言 7個以上</span>
            <span className="ra-arrow">vs</span>
            <span className="ra-tag">実際 {wild ? 7 : 5}個</span>
          </div>
          <span className="ra-beer ra-pop" style={delay(0.8)}>
            {wild ? "本当だった → ダウトした人🍺" : "嘘だった → 宣言した人🍺"}
          </span>
        </div>
      ),
    },
  ];
}

function highLowScenes(): Scene[] {
  return [
    {
      caption: "次のカードを全員で予想",
      sub: "赤か黒か？ 上か下か？…",
      body: (
        <div className="ra-row">
          <Trump card={null} />
          <div className="ra-col ra-col-tight">
            <div className="ra-row ra-row-tight">
              <Who c="cat" />
              <Bubble tone="ra-bubble-red" style={delay(0.3)}>
                赤！
              </Bubble>
            </div>
            <div className="ra-row ra-row-tight">
              <Who c="dog" />
              <Bubble tone="ra-bubble-ink" style={delay(0.7)}>
                黒！
              </Bubble>
            </div>
          </div>
        </div>
      ),
    },
    {
      caption: "めくって答え合わせ",
      body: (
        <div className="ra-row">
          <span className="ra-flip">
            <Trump card={{ rank: 8, suit: "H" }} big />
          </span>
          <span className="ra-tag ra-pop" style={delay(1)}>
            赤が正解！
          </span>
        </div>
      ),
    },
    {
      caption: "当たった人はバスを降りる",
      sub: "セーフ！",
      body: (
        <div className="ra-bus">
          <span className="ra-bus-icon">🚌</span>
          {PEOPLE.map((c, i) => (
            <span key={c} className={i % 2 === 0 ? "ra-hop" : ""} style={delay(0.5 + i * 0.2)}>
              <Avatar character={c} size="md" />
            </span>
          ))}
        </div>
      ),
    },
    {
      caption: "最後まで残った1人が負け",
      body: (
        <div className="ra-bus">
          <span className="ra-bus-icon">🚌</span>
          <Avatar character="bear" size="md" />
          <span className="ra-beer ra-pop" style={delay(0.6)}>
            🍺
          </span>
        </div>
      ),
    },
  ];
}

function kabuttaraScenes(): Scene[] {
  const picks: { c: AnimalId; pick: string }[] = [
    { c: "cat", pick: "🐼" },
    { c: "dog", pick: "🐼" },
    { c: "rabbit", pick: "🐸" },
  ];
  return [
    {
      caption: "動物をこっそり1匹選ぶ",
      body: (
        <div className="ra-row">
          {picks.map((p, i) => (
            <span key={p.c} className="ra-col ra-col-tight">
              <Bubble tone="ra-wobble" style={delay(i * 0.2)}>
                ？
              </Bubble>
              <Avatar character={p.c} size="md" />
            </span>
          ))}
        </div>
      ),
    },
    {
      caption: "一斉に公開！",
      body: (
        <div className="ra-row">
          {picks.map((p, i) => (
            <span key={p.c} className="ra-col ra-col-tight">
              <Bubble tone="ra-big" style={delay(0.3 + i * 0.3)}>
                {p.pick}
              </Bubble>
              <Avatar character={p.c} size="md" />
            </span>
          ))}
        </div>
      ),
    },
    {
      caption: "被らなかった人は抜ける",
      sub: "被った人は残ってもう一回",
      body: (
        <div className="ra-row">
          {picks.map((p, i) => (
            <span
              key={p.c}
              className={`ra-col ra-col-tight ${i < 2 ? "ra-shake-red" : "ra-hop"}`}
              style={delay(0.5)}
            >
              <Bubble tone="ra-big">{p.pick}</Bubble>
              <Avatar character={p.c} size="md" />
              {i === 2 && <span className="ra-tag">セーフ</span>}
            </span>
          ))}
        </div>
      ),
    },
    {
      caption: "最後に残った1人が負け",
      sub: "抜けた人は「おじゃま役」で被せにいける",
      body: (
        <div className="ra-row">
          <Avatar character="cat" size="lg" />
          <span className="ra-beer ra-pop" style={delay(0.6)}>
            🍺
          </span>
        </div>
      ),
    },
  ];
}

function wolfScenes(): Scene[] {
  const house = (emoji: string, name: string, pigs: number, extra = "") => (
    <span className={`ra-house ${extra}`}>
      <span className="ra-house-emoji">{emoji}</span>
      <span className="ra-house-name">{name}</span>
      <span className="ra-house-pigs">
        {Array.from({ length: pigs }, (_, i) => (
          <span key={i} className="ra-drop" style={delay(0.4 + i * 0.35)}>
            🐷
          </span>
        ))}
      </span>
    </span>
  );
  return [
    {
      caption: "1人だけこっそり狼",
      sub: "誰が狼かは分からない",
      body: (
        <div className="ra-row">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`ra-face ${i === 2 ? "ra-face-wolf" : ""}`}>
              <span className="ra-face-pig">🐷</span>
              {i === 2 && <span className="ra-face-alt">🐺</span>}
            </span>
          ))}
        </div>
      ),
    },
    {
      caption: "3軒の家から1つに隠れる",
      sub: "狼は襲う家を選ぶ",
      body: (
        <div className="ra-row ra-row-tight">
          {house("🌾", "わら", 2)}
          {house("🪵", "木", 1)}
          {house("🧱", "レンガ", 0)}
        </div>
      ),
    },
    {
      caption: "狼が1軒を襲う！",
      body: (
        <div className="ra-col">
          <span className="ra-wolf-run">🐺</span>
          <div className="ra-row ra-row-tight">
            {house("🌾", "わら", 2, "ra-attacked")}
            {house("🪵", "木", 1)}
            {house("🧱", "レンガ", 0)}
          </div>
        </div>
      ),
    },
    {
      caption: "結果は3パターン",
      body: (
        <div className="ra-results">
          <span className="ra-result ra-pop" style={delay(0.2)}>
            <span>🏠🐷</span>
            <b>その子豚の負け</b>
          </span>
          <span className="ra-result ra-pop" style={delay(0.9)}>
            <span>🏠🐷🐷</span>
            <b>延長戦</b>
          </span>
          <span className="ra-result ra-pop" style={delay(1.6)}>
            <span>🏠💨</span>
            <b>狼の負け</b>
          </span>
        </div>
      ),
    },
  ];
}

function greedyScenes(config: Config): Scene[] {
  const two = config.dice === 2;
  return [
    {
      caption: "振って点を貯める",
      sub: two ? "サイコロ2個の合計を足していく" : "出た目を足していく",
      body: (
        <div className="ra-row">
          <Die face={4} />
          <span className="ra-pop" style={delay(0.5)}>
            <Die face={5} />
          </span>
          <span className="ra-arrow">→</span>
          <span className="ra-total ra-swap">
            <span className="ra-swap-old">4点</span>
            <span className="ra-swap-new">9点</span>
          </span>
        </div>
      ),
    },
    {
      caption: "何回でも振れる",
      sub: "満足したら「止める」で確定",
      body: (
        <div className="ra-col">
          <div className="ra-row">
            <Who c="cat" />
            <Bubble style={delay(0.3)}>もう1回いけ！</Bubble>
          </div>
          <div className="ra-row">
            <Who c="dog" />
            <Bubble tone="ra-bubble-ink" style={delay(1.1)}>
              やめとけ！
            </Bubble>
          </div>
        </div>
      ),
    },
    {
      caption: "1が出たら0点！",
      sub: "貯めた点が全部消える",
      body: (
        <div className="ra-row">
          <span className="ra-total">17点</span>
          <span className="ra-pop" style={delay(0.4)}>
            <Die face={1} hit />
          </span>
          <span className="ra-total ra-bust ra-pop" style={delay(1.2)}>
            0点
          </span>
        </div>
      ),
    },
    {
      caption: "一番低い人が負け",
      sub: "全員1回ずつ挑戦したら決着",
      body: (
        <div className="ra-results">
          {(
            [
              ["cat", "14点"],
              ["dog", "0点"],
              ["rabbit", "9点"],
            ] as const
          ).map(([c, score], i) => (
            <span key={c} className="ra-result ra-pop" style={delay(0.2 + i * 0.4)}>
              <Avatar character={c} size="sm" />
              <b>{score}</b>
              {c === "dog" && <span>🍺</span>}
            </span>
          ))}
        </div>
      ),
    },
  ];
}

interface MiniCell {
  cls?: string;
  label?: string;
  style?: CSSProperties;
}

function MiniGrid({ cols, cells }: { cols: number; cells: MiniCell[] }) {
  return (
    <div className="ra-mini-grid" style={{ "--cols": cols } as CSSProperties}>
      {cells.map((c, i) => (
        <span key={i} className={c.cls} style={c.style}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** 4×3 の盤（地雷は 9 のマス）。開いたマスの数字は実際の配置と合わせる */
const openMine = (n: number, extra = "", style?: CSSProperties): MiniCell => ({
  cls: `mine-cell mine-open mine-n${n} ${extra}`,
  label: n === 0 ? "・" : `${n}`,
  style,
});

function mineBoard(overrides: Record<number, MiniCell>): MiniCell[] {
  return Array.from({ length: 12 }, (_, i) => overrides[i] ?? { cls: "mine-cell" });
}

const OPENED: Record<number, MiniCell> = {
  0: openMine(0),
  1: openMine(0),
  4: openMine(1),
  5: openMine(1),
};

function minesweeperScenes(): Scene[] {
  return [
    {
      caption: "順番に1マス開ける",
      sub: "1マス目は必ず安全",
      body: <MiniGrid cols={4} cells={mineBoard({ 5: openMine(1, "ra-pop", delay(0.5)) })} />,
    },
    {
      caption: "数字＝まわりの地雷数",
      sub: "まわり8マスに何個あるか",
      body: (
        <MiniGrid cols={4} cells={mineBoard({ ...OPENED, 8: openMine(1, "ra-pop", delay(0.4)) })} />
      ),
    },
    {
      caption: "みんなで見て考える",
      sub: "口出しOK。決めるのは手番の人",
      body: (
        <div className="ra-col">
          <div className="ra-row">
            <Who c="cat" />
            <Bubble style={delay(0.3)}>そこ危ない！</Bubble>
          </div>
          <div className="ra-row">
            <Who c="rabbit" />
            <Bubble tone="ra-bubble-ink" style={delay(1.1)}>
              いや、ここは安全
            </Bubble>
          </div>
        </div>
      ),
    },
    {
      caption: "地雷を踏んだら負け",
      body: (
        <div className="ra-row">
          <MiniGrid
            cols={4}
            cells={mineBoard({
              ...OPENED,
              8: openMine(1),
              9: { cls: "mine-cell mine-boom ra-pop", label: "💥", style: delay(0.4) },
            })}
          />
          <span className="ra-beer ra-pop" style={delay(1.2)}>
            アウト🍺
          </span>
        </div>
      ),
    },
  ];
}

function chocoScenes(): Scene[] {
  // 5×3 の板チョコ（上の段から）。左下が毒
  const cols = 5;
  const rows = 3;
  const board = (heights: number[], cell: (col: number, row: number) => MiniCell | null) =>
    Array.from({ length: rows }, (_, i) => rows - 1 - i).flatMap((row) =>
      Array.from({ length: cols }, (_, col): MiniCell => {
        const custom = cell(col, row);
        if (custom) return custom;
        if (row >= heights[col]) return { cls: "choco-cell choco-eaten" };
        if (col === 0 && row === 0) return { cls: "choco-cell choco-poison", label: "☠️" };
        return { cls: "choco-cell" };
      }),
    );
  return [
    {
      caption: "板チョコを順番にかじる",
      sub: "左下の1かけだけ毒入り",
      body: <MiniGrid cols={cols} cells={board([3, 3, 3, 3, 3], () => null)} />,
    },
    {
      caption: "選んだ所から右上を全部",
      sub: "大きく食べるか、少しずつか",
      body: (
        <MiniGrid
          cols={cols}
          cells={board([3, 3, 3, 3, 3], (col, row) =>
            col >= 2 && row >= 1 ? { cls: "choco-cell choco-bite" } : null,
          )}
        />
      ),
    },
    {
      caption: "毒は最後の1かけ",
      sub: "ほかがなくなるまで食べられない",
      body: <MiniGrid cols={cols} cells={board([1, 0, 0, 0, 0], () => null)} />,
    },
    {
      caption: "毒を食べた人が負け",
      body: (
        <div className="ra-row">
          <MiniGrid
            cols={cols}
            cells={board([1, 0, 0, 0, 0], (col, row) =>
              col === 0 && row === 0
                ? { cls: "choco-cell choco-poison choco-poison-eaten", label: "☠️" }
                : null,
            )}
          />
          <span className="ra-beer ra-pop" style={delay(0.8)}>
            🍺
          </span>
        </div>
      ),
    },
  ];
}

export function scenesFor(gameId: GameId, config: Config): Scene[] {
  switch (gameId) {
    case "hundred-one":
      return hundredOneScenes(config);
    case "liars-dice":
      return liarsDiceScenes(config);
    case "high-low":
      return highLowScenes();
    case "kabuttara-out":
      return kabuttaraScenes();
    case "wolf-and-pigs":
      return wolfScenes();
    case "greedy-dice":
      return greedyScenes(config);
    case "minesweeper":
      return minesweeperScenes();
    case "poison-choco":
      return chocoScenes();
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function RuleAnimation({ gameId, config }: { gameId: GameId; config: Config }) {
  const scenes = scenesFor(gameId, config);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(
    () => typeof window === "undefined" || !prefersReducedMotion(),
  );
  const scene = scenes[index % scenes.length];

  // コマを自動で送る（手動で送ったときもタイマーをやり直す）
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setIndex((index + 1) % scenes.length), SCENE_MS);
    return () => clearTimeout(t);
  }, [index, playing, scenes.length]);

  const go = (i: number) => setIndex((i + scenes.length) % scenes.length);

  return (
    <div className="ra" aria-roledescription="ルールのアニメーション">
      <div className="ra-stage" key={`${gameId}-${index}`} onClick={() => go(index + 1)}>
        {scene.body}
      </div>
      <div className="ra-caption" key={`c-${gameId}-${index}`}>
        <span className="ra-step">{index + 1}</span>
        <span className="ra-caption-text">
          <b>{scene.caption}</b>
          {scene.sub && <small>{scene.sub}</small>}
        </span>
      </div>
      <div className="ra-controls">
        <button
          type="button"
          className="btn btn-sq btn-sm"
          onClick={() => go(index - 1)}
          aria-label="前へ"
        >
          ‹
        </button>
        <span className="ra-dots">
          {scenes.map((s, i) => (
            <button
              key={s.caption}
              type="button"
              className={`ra-dot ${i === index ? "ra-dot-on" : ""}`}
              onClick={() => go(i)}
              aria-label={`${i + 1}コマ目`}
            />
          ))}
        </span>
        <button
          type="button"
          className="btn btn-sq btn-sm"
          onClick={() => go(index + 1)}
          aria-label="次へ"
        >
          ›
        </button>
        <button type="button" className="btn btn-sm ra-play" onClick={() => setPlaying((p) => !p)}>
          {playing ? "⏸ 止める" : "▶ 再生"}
        </button>
      </div>
    </div>
  );
}
