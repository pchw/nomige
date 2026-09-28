import { useState } from "react";
import { Form, redirect, useNavigate, useNavigation } from "react-router";
import { GAME_META } from "~/games/meta";
import { GAME_ORDER, GAMES, isGameId } from "~/games/registry";
import { createRoom } from "~/server/rooms.server";
import type { Route } from "./+types/_index";

export function meta() {
  return [
    { title: "NOMIGE — 飲みゲー" },
    { name: "description", content: "3〜10人で遊べる飲みゲー。スマホでもタブレット1台でも。" },
  ];
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
  const creating = navigation.state !== "idle" ? navigation.formData?.get("gameId") : null;

  return (
    <main className="page">
      <header className="hero">
        <p className="hero-kicker">PARTY DRINKING GAMES</p>
        <h1 className="hero-title">
          NOMI<span>GE</span>
        </h1>
        <p className="hero-lead">
          3〜10人で遊べる飲みゲー。
          <br />
          テーブルにタブレット1台でも、各自のスマホでもOK。
        </p>
      </header>

      <section className="section">
        <h2 className="section-title">ゲームを選んでルームを作る</h2>
        <div className="game-grid">
          {GAME_ORDER.map((id) => {
            const game = GAMES[id];
            const info = GAME_META[id];
            return (
              <Form
                method="post"
                key={id}
                className="game-card"
                style={{ "--accent": info.color } as React.CSSProperties}
              >
                <input type="hidden" name="gameId" value={id} />
                <div className="game-card-head">
                  <span className="game-emoji" aria-hidden>
                    {info.emoji}
                  </span>
                  <h3>{game.name}</h3>
                </div>
                <p className="game-tagline">{game.tagline}</p>
                <ul className="tags">
                  <li>
                    {game.minPlayers}〜{game.maxPlayers}人
                  </li>
                  <li>{info.duration}</li>
                  <li>{info.style}</li>
                </ul>
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
  );
}
