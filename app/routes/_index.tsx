import { useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/_index";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";

export function meta() {
  return [
    { title: "King's Cribbage Online — Free Multiplayer Tile Game" },
    { name: "description", content: "Play King's Cribbage online free with 2–4 players. The classic cribbage tile game — share a link and play anywhere, no download required." },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Tabledeck" },
    { property: "og:title", content: "King's Cribbage Online — Free Multiplayer Tile Game" },
    { property: "og:description", content: "Play King's Cribbage online free with 2–4 players. Share a link and play anywhere, no download required." },
    { property: "og:url", content: "https://kingscrib.tabledeck.us" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "King's Cribbage Online — Free Multiplayer Tile Game" },
    { name: "twitter:description", content: "Play King's Cribbage online free with 2–4 players. Share a link and play anywhere." },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: "canonical", href: "https://kingscrib.tabledeck.us" },
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  return { user: user ? { name: user.name, email: user.email } : null };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [playerCount, setPlayerCount] = useState(2);

  const createGame = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPlayers: playerCount }),
      });
      const { gameId } = (await res.json()) as { gameId: string };
      navigate(`/game/${gameId}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <a href="https://tabledeck.us" className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 text-sm">
        ← tabledeck.us
      </a>
      <div className="absolute top-4 right-4 flex gap-3">
        {user ? (
          <>
            <a
              href="/profile"
              className="text-gray-300 hover:text-white text-sm"
            >
              {user.name || user.email}
            </a>
            <a
              href="/logout"
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              Logout
            </a>
          </>
        ) : (
          <>
            <a href="/login" className="text-gray-300 hover:text-white text-sm">
              Login
            </a>
            <a
              href="/signup"
              className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
            >
              Sign Up
            </a>
          </>
        )}
      </div>

      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-3">King's Cribbage</h1>
        <p className="text-gray-400 text-lg max-w-md">
          The classic tile game — play cribbage hands on a board with friends.
          Share a link to play anywhere.
        </p>
      </div>

      {/* Create Game */}
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
        <h2 className="text-white font-semibold text-xl mb-6">New Game</h2>

        <label className="text-gray-400 text-sm block mb-2">Players</label>
        <div className="flex gap-2 mb-6">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                playerCount === n
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {n} Players
            </button>
          ))}
        </div>

        <button
          onClick={createGame}
          disabled={creating}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-lg transition-colors"
        >
          {creating ? "Creating..." : "Create Game"}
        </button>

        <p className="text-gray-500 text-xs text-center mt-4">
          You'll get a shareable link to send to your friends
        </p>
      </div>

      {/* How to play */}
      <div className="mt-10 text-center">
        <a
          href="https://www.cococogames.com/instructions.htm#english"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-300 text-sm underline"
        >
          How to play King's Cribbage
        </a>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: "King's Cribbage",
            description: "The classic cribbage tile game — play cribbage hands on a board with friends.",
            url: "https://kingscrib.tabledeck.us",
            genre: "Board Game",
            numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 4 },
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            publisher: { "@type": "Organization", name: "Tabledeck" },
          }),
        }}
      />
    </div>
  );
}
