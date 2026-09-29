import { data, isRouteErrorResponse, useRouteError } from "react-router";
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
  const error = useRouteError();
  // ルームがない（404）ときと、画面の表示中に壊れたときで案内を分ける
  if (isRouteErrorResponse(error) && error.status === 404) {
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
  console.error(error);
  return (
    <main className="page">
      <div className="panel panel-pink">
        <h1 className="display">画面の表示でエラーが起きました</h1>
        <p>再読み込みすると、同じルームに戻れます。</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </div>
    </main>
  );
}
