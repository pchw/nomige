import { normalizeCode, roomStub } from "~/server/rooms.server";
import type { Route } from "./+types/api.rooms.$code.ws";

/** GET /api/rooms/:code/ws — WebSocket をルームの Durable Object に中継する */
export async function loader({ request, params }: Route.LoaderArgs) {
  const code = normalizeCode(params.code);
  if (!code) return new Response("invalid room code", { status: 400 });
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("expected websocket", { status: 426 });
  }
  return roomStub(code).fetch(request);
}
