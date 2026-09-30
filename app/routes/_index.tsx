import { useState } from "react";
import { Form, redirect, useNavigate, useNavigation } from "react-router";
import { accentStyle, GameCardBody } from "~/components/GamePicker";
import { RulesButton, RulesProvider, type RulesTarget } from "~/components/Rules";
import { GAME_ORDER, isGameId } from "~/games/registry";
import { createRoom } from "~/server/rooms.server";
import { pageMeta, siteOrigin } from "~/seo";
import type { Route } from "./+types/_index";

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta({ origin: siteOrigin(matches), path: "/", title: "NOMIGE — 飲みゲー" });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const gameId = form.get("gameId");
  if (!isGameId(gameId)) throw new Response("不明なゲームです", { status: 400 });
  const code = await createRoom(gameId);
  return redirect(`/r/${code}`);
}

export default function Home() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [rulesTarget, setRulesTarget] = useState<RulesTarget | null>(null);
  const creating = navigation.state !== "idle" ? navigation.formData?.get("gameId") : null;

  return (
    <RulesProvider target={rulesTarget} onChange={setRulesTarget}>
      <main className="page">
        <header className="hero">
          <p className="hero-kicker">PARTY DRINKING GAMES</p>
          <h1 className="hero-title">
            NOMI<span>GE</span>
          </h1>
          <p className="hero-lead">
            2〜10人で遊べる飲みゲー。
            <br />
            テーブルにタブレット1台でも、各自のスマホでもOK。
          </p>
        </header>

        <section className="section">
          <h2 className="section-title">ゲームを選んでルームを作る</h2>
          <div className="game-grid">
            {GAME_ORDER.map((id) => {
              return (
                <Form method="post" key={id} className="game-card" style={accentStyle(id)}>
                  <input type="hidden" name="gameId" value={id} />
                  <GameCardBody id={id} />
                  <RulesButton gameId={id} />
                  <button className="btn btn-block" type="submit" disabled={Boolean(creating)}>
                    {creating === id ? "作成中…" : "このゲームで遊ぶ →"}
                  </button>
                </Form>
              );
            })}
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">ルームに参加する</h2>
          <form
            className="panel join-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) navigate(`/r/${code.trim().toUpperCase()}`);
            }}
          >
            <input
              className="input input-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              aria-label="ルームコード"
            />
            <button className="btn btn-blue" type="submit">
              参加
            </button>
          </form>
        </section>

        <footer className="footer">
          <p>20歳未満の飲酒は法律で禁止されています。</p>
          <p>ソフトドリンクでも遊べます。飲みすぎ注意・水もいっしょに。</p>
        </footer>
      </main>
    </RulesProvider>
  );
}
