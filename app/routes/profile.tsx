import { redirect } from "react-router";
import type { Route } from "./+types/profile";
import { getPrisma } from "~/db.server";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";

export function meta() {
  return [{ title: "Profile — King's Cribbage" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  if (!user) throw redirect("/login");

  const db = getPrisma(context);
  const gamePlayers = await db.gamePlayer.findMany({
    where: { userId: user.id },
    include: {
      game: {
        select: {
          id: true,
          status: true,
          maxPlayers: true,
          createdAt: true,
          finishedAt: true,
          players: {
            select: { seat: true, score: true, user: { select: { name: true, email: true } }, guestName: true },
          },
        },
      },
    },
    orderBy: { game: { createdAt: "desc" } },
    take: 20,
  });

  return {
    user: { name: user.name, email: user.email },
    games: gamePlayers.map((gp) => ({
      gameId: gp.game.id,
      status: gp.game.status,
      myScore: gp.score,
      seat: gp.seat,
      createdAt: gp.game.createdAt.toISOString(),
      finishedAt: gp.game.finishedAt?.toISOString() ?? null,
      players: gp.game.players.map((p) => ({
        seat: p.seat,
        score: p.score,
        name: p.user?.name || p.user?.email || p.guestName || "Guest",
      })),
    })),
  };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, games } = loaderData;

  const wins = games.filter((g) => {
    if (g.status !== "finished") return false;
    const maxScore = Math.max(...g.players.map((p) => p.score));
    return g.myScore === maxScore;
  }).length;

  const finished = games.filter((g) => g.status === "finished").length;

  return (
    <div className="min-h-screen bg-gray-950 p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-gray-400 hover:text-white text-sm">
          ← Home
        </a>
        <a href="/logout" className="text-gray-500 hover:text-gray-300 text-sm">
          Logout
        </a>
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
        <h1 className="text-white font-bold text-2xl mb-1">
          {user.name || user.email}
        </h1>
        <p className="text-gray-500 text-sm">{user.email}</p>
        <div className="flex gap-6 mt-4">
          <div className="text-center">
            <p className="text-white font-bold text-2xl">{finished}</p>
            <p className="text-gray-500 text-xs">Games</p>
          </div>
          <div className="text-center">
            <p className="text-emerald-400 font-bold text-2xl">{wins}</p>
            <p className="text-gray-500 text-xs">Wins</p>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-2xl">
              {finished > 0 ? Math.round((wins / finished) * 100) : 0}%
            </p>
            <p className="text-gray-500 text-xs">Win rate</p>
          </div>
        </div>
      </div>

      <h2 className="text-white font-semibold mb-3">Recent Games</h2>
      <div className="space-y-3">
        {games.length === 0 && (
          <p className="text-gray-500 text-sm">No games yet. Create one!</p>
        )}
        {games.map((g) => (
          <a
            key={g.gameId}
            href={`/game/${g.gameId}`}
            className="block bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 font-mono text-sm">#{g.gameId}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  g.status === "finished"
                    ? "bg-gray-700 text-gray-400"
                    : g.status === "active"
                      ? "bg-emerald-900 text-emerald-400"
                      : "bg-yellow-900 text-yellow-400"
                }`}
              >
                {g.status}
              </span>
            </div>
            <div className="flex gap-3 flex-wrap">
              {g.players
                .sort((a, b) => b.score - a.score)
                .map((p) => (
                  <span
                    key={p.seat}
                    className={`text-sm ${p.seat === g.seat ? "text-emerald-400 font-semibold" : "text-gray-400"}`}
                  >
                    {p.name}: {p.score}
                  </span>
                ))}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
