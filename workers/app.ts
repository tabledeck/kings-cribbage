import { createRequestHandler, RouterContextProvider } from "react-router";
export { GameRoomDO } from "./game-room";

// @ts-expect-error - build output has no type declarations
const buildImport = () => import("../build/server/index.js");

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Redirect root and www to the game subdomain until the homepage is built
    if (url.hostname === "tabledeck.us" || url.hostname === "www.tabledeck.us") {
      return Response.redirect(`https://kingscrib.tabledeck.us${url.pathname === "/" ? "" : url.pathname}`, 302);
    }

    // Route WebSocket upgrades for game rooms to the Durable Object
    // Pattern: /game/:gameId/ws
    const wsMatch = url.pathname.match(/^\/game\/([^/]+)\/ws$/);
    if (wsMatch && request.headers.get("Upgrade") === "websocket") {
      const gameId = wsMatch[1];
      const id = env.GAME_ROOM.idFromName(gameId);
      const stub = env.GAME_ROOM.get(id);
      const doUrl = new URL(request.url);
      doUrl.pathname = "/ws";
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    // Internal DO→DB move persistence calls
    const moveMatch = url.pathname.match(/^\/api\/game\/([^/]+)\/move$/);
    if (moveMatch && request.method === "POST") {
      // Pass through to React Router for processing
    }

    // Bridge Cloudflare env bindings into process.env
    Object.assign(process.env, env);

    const context = new RouterContextProvider();
    (context as any).cloudflare = { env, ctx };

    return createRequestHandler(buildImport, "production")(request, context);
  },
} satisfies ExportedHandler<Env>;
