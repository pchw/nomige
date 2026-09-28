import { createContext, useContext, useEffect, type ReactNode } from "react";
import { GAME_META } from "~/games/meta";
import { GAMES } from "~/games/registry";
import { COMMON_RULES, rulesFor, type RuleSection } from "~/games/rules";
import type { GameId } from "~/games/types";

type Config = Record<string, unknown>;

function Section({ section }: { section: RuleSection }) {
  return (
    <section className="rule-section">
      <h4 className="rule-title">{section.title}</h4>
      {section.steps && (
        <ol className="rule-steps">
          {section.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {section.items && (
        <ul className="rule-items">
          {section.items.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {section.table && (
        <div className="rule-table-wrap">
          <table className="rule-table">
            <thead>
              <tr>
                {section.table.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.example && (
        <div className="rule-example">
          {section.example.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      )}
    </section>
  );
}

/** 詳しいルール本文。config は今の設定（設定によって文面が変わる） */
export function RulesView({ gameId, config }: { gameId: GameId; config: Config }) {
  const doc = rulesFor(gameId, config);
  return (
    <div className="rules-view">
      <p className="rule-goal">{doc.goal}</p>
      {doc.sections.map((s) => (
        <Section key={s.title} section={s} />
      ))}
      <Section section={COMMON_RULES} />
    </div>
  );
}

function RulesModal({
  gameId,
  config,
  switched,
  onClose,
}: {
  gameId: GameId;
  config: Config;
  switched: boolean;
  onClose: () => void;
}) {
  const meta = GAME_META[gameId];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal rules-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${GAMES[gameId].name}のルール`}
        style={{ "--accent": meta.color } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          {switched && <p className="modal-kicker">次のゲームはこれ！ルールを確認しよう</p>}
          <h3 className="rules-title">
            <span className="game-emoji" aria-hidden>
              {meta.emoji}
            </span>
            {GAMES[gameId].name}
          </h3>
          <button
            type="button"
            className="btn btn-sq btn-sm modal-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          <RulesView gameId={gameId} config={config} />
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn btn-lg btn-block btn-green" onClick={onClose}>
            {switched ? "ルールOK！" : "閉じる"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export interface RulesTarget {
  gameId: GameId;
  /** ゲームが切り替わったことで自動で開いた */
  switched?: boolean;
}

const ShowRulesContext = createContext<(gameId: GameId) => void>(() => {});

/** 「ルールを見る」ボタンから呼ぶ */
export function useShowRules() {
  return useContext(ShowRulesContext);
}

/**
 * ルールのモーダルを持つ Provider。開いているゲームは呼び出し側が管理する。
 * configFor で今の設定を渡す（渡さない・未設定のゲームは初期設定で表示）。
 */
export function RulesProvider({
  target,
  onChange,
  configFor,
  children,
}: {
  target: RulesTarget | null;
  onChange: (target: RulesTarget | null) => void;
  configFor?: (gameId: GameId) => Config | undefined;
  children: ReactNode;
}) {
  return (
    <ShowRulesContext value={(gameId) => onChange({ gameId })}>
      {children}
      {target && (
        <RulesModal
          gameId={target.gameId}
          config={configFor?.(target.gameId) ?? GAMES[target.gameId].defaultConfig}
          switched={Boolean(target.switched)}
          onClose={() => onChange(null)}
        />
      )}
    </ShowRulesContext>
  );
}

export function RulesButton({
  gameId,
  label = "📖 ルールを見る",
}: {
  gameId: GameId;
  label?: string;
}) {
  const show = useShowRules();
  return (
    <button type="button" className="btn btn-sm btn-rules" onClick={() => show(gameId)}>
      {label}
    </button>
  );
}
