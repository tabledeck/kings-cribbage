import { data } from "react-router";
import type { Route } from "./+types/game";
import { getPrisma } from "~/db.server";
import { nanoid } from "nanoid";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { z } from "zod";

const CopiedSettingsSchema = z.object({
  maxPlayers: z.number().int().min(2).max(4).default(2),
  timePerTurn: z.number().int().min(0).default(0),
});

const CreateGameSchema = CopiedSettingsSchema.extend({
  rematchOf: z.string().min(1).optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw data({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const parsed = CreateGameSchema.safeParse(body);
  if (!parsed.success) {
    throw data({ error: "Invalid request" }, { status: 400 });
  }

  const db = getPrisma(context);
  const { rematchOf } = parsed.data;
  let { maxPlayers, timePerTurn } = parsed.data;

  if (rematchOf) {
    const originalGame = await db.game.findUnique({
      where: { id: rematchOf },
      select: { settings: true },
    });

    if (!originalGame) {
      throw data({ error: "Original game not found" }, { status: 404 });
    }

    let originalSettingsJson: unknown;
    try {
      originalSettingsJson = JSON.parse(originalGame.settings);
    } catch {
      throw data({ error: "Original game settings are invalid" }, { status: 400 });
    }

    const originalSettings = CopiedSettingsSchema.safeParse(originalSettingsJson);
    if (!originalSettings.success) {
      throw data({ error: "Original game settings are invalid" }, { status: 400 });
    }

    ({ maxPlayers, timePerTurn } = originalSettings.data);
  }

  const gameId = nanoid(6); // short, URL-friendly ID
  const seed = Math.floor(Math.random() * 2 ** 32);

  await db.game.create({
    data: {
      id: gameId,
      maxPlayers,
      settings: JSON.stringify({ seed, maxPlayers, timePerTurn }),
    },
  });

  // Initialize the Durable Object for this game
  const env = (context as any).cloudflare.env as Env;
  const doId = env.GAME_ROOM.idFromName(gameId);
  const stub = env.GAME_ROOM.get(doId);

  // Create the DO with settings
  const doUrl = new URL(`http://internal/create`);
  await stub.fetch(
    new Request(doUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        settings: { seed, maxPlayers, timePerTurn },
      }),
    }),
  );

  // If user is logged in, auto-join seat 0
  const user = getOptionalUserFromContext(context);
  if (user) {
    // Sync user into D1_DATABASE (users live in AUTH_DB; D1 enforces FK constraints)
    await db.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email, name: user.name || "" },
      update: { name: user.name || "", email: user.email },
    });
    await db.gamePlayer.create({
      data: {
        gameId,
        userId: user.id,
        seat: 0,
        guestName: null,
      },
    });
  }

  return data({ gameId });
}
