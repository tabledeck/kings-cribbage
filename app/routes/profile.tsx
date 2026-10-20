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
    <div className="td-surface auth-page" style={{ justifyContent: "flex-start", paddingTop: 24 }}>
      <nav className="lobby-nav" style={{ marginBottom: 16 }}>
        <a href="/" className="lobby-nav-link">← Table</a>
        <a href="/logout" className="lobby-nav-link is-quiet">Logout</a>
      </nav>
      <div className="td-lobby-card" style={{ maxWidth: 560 }}>
        <h2>{user.name || user.email}</h2>
        <p className="font-sans text-sm" style={{ color: "var(--ink-faint)", marginTop: -8 }}>{user.email}</p>
        <div className="flex gap-6 mt-4 mb-2">
          <div>
            <p className="font-mono text-2xl" style={{ color: "var(--walnut)", margin: 0 }}>{finished}</p>
            <p className="font-serif text-xs" style={{ color: "var(--ink-faint)" }}>Finished</p>
          </div>
          <div>
            <p className="font-mono text-2xl" style={{ color: "var(--wine)", margin: 0 }}>{wins}</p>
            <p className="font-serif text-xs" style={{ color: "var(--ink-faint)" }}>Wins</p>
          </div>
          <div>
            <p className="font-mono text-2xl" style={{ color: "var(--walnut)", margin: 0 }}>
              {finished > 0 ? Math.round((wins / finished) * 100) : 0}%
            </p>
            <p className="font-serif text-xs" style={{ color: "var(--ink-faint)" }}>Win rate</p>
          </div>
        </div>
      </div>
      <div className="w-full mt-4" style={{ maxWidth: 560 }}>
        {games.length === 0 && (
          <p className="font-sans text-sm text-center" style={{ color: "rgba(246,239,224,0.7)" }}>
            No games yet.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {games.map((g) => (
            <a key={g.gameId} href={`/game/${g.gameId}`} className="td-plaque" style={{ display: "block", textDecoration: "none" }}>
              <div className="flex items-center justify-between w-full gap-3">
                <span className="font-mono text-sm" style={{ color: "var(--walnut)" }}>#{g.gameId}</span>
                <span className="font-serif text-sm" style={{ color: "var(--wine)" }}>{g.status}</span>
              </div>
              <div className="flex gap-3 flex-wrap mt-2">
                {g.players
                  .sort((a, b) => b.score - a.score)
                  .map((p) => (
                    <span
                      key={p.seat}
                      className="font-sans text-sm"
                      style={{ color: p.seat === g.seat ? "var(--wine)" : "var(--ink-soft)", fontWeight: p.seat === g.seat ? 700 : 400 }}
                    >
                      {p.name}: {p.score}
                    </span>
                  ))}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
