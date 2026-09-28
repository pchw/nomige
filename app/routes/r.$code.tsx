import { data } from "react-router";
import { RoomApp } from "~/components/RoomApp";
import { GAMES } from "~/games/registry";
import { normalizeCode, roomInfo } from "~/server/rooms.server";
import type { Route } from "./+types/r.$code";

export async function loader({ params }: Route.LoaderArgs) {
  const code = normalizeCode(params.code);
  if (!code) throw data("ルームコードが正しくありません", { status: 404 });
  const info = await roomInfo(code);
  if (!info.exists) throw data("ルームが見つかりません", { status: 404 });
  return { code, gameName: GAMES[info.gameId].name };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.gameName} — ${loaderData.code} | NOMIGE` : "NOMIGE" },
  ];
}

export default function RoomPage({ loaderData }: Route.ComponentProps) {
  return <RoomApp code={loaderData.code} />;
}

export function ErrorBoundary() {
  return (
    <main className="page">
      <div className="panel panel-pink">
        <h1 className="display">ルームが見つかりません</h1>
        <p>コードを確認するか、新しくルームを作ってください。</p>
        <a className="btn" href="/">
          トップへ
        </a>
      </div>
    </main>
  );
}
