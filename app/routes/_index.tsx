import { useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/_index";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { BtnPrimary } from "~/components/tabledeck/BtnPrimary";

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

// King's Cribbage crest: walnut shield + gold crown + card suits
function KingsCrest({ size = 80 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-label="King's Cribbage crest"
    >
      <defs>
        <radialGradient id="kg-gold" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#e8c872" />
          <stop offset="55%" stopColor="#c9a24a" />
          <stop offset="100%" stopColor="#7f5a17" />
        </radialGradient>
      </defs>
      {/* shield */}
      <path
        d="M12 10h40v22c0 12-10 20-20 24-10-4-20-12-20-24z"
        fill="#6b1a21"
        stroke="#3a2416"
        strokeWidth="1.8"
      />
      {/* crown */}
      <path
        d="M14 10l4-8 6 4 4-8 4 8 6-4 4 8z"
        fill="url(#kg-gold)"
        stroke="#6b1a21"
        strokeWidth="1.2"
      />
      <circle cx="22" cy="4" r="1.5" fill="#6b1a21" />
      <circle cx="42" cy="4" r="1.5" fill="#6b1a21" />
      {/* card suits inside shield */}
      <g fill="url(#kg-gold)">
        <path d="M22 22c0-2 1-3 3-3s3 1 3 3-2 3-3 5c-1-2-3-3-3-5z" />
        <path d="M38 22c0-2 1-3 3-3s3 1 3 3-2 3-3 5c-1-2-3-3-3-5z" />
        <path d="M32 38l-4-6 2-2 2 2 2-2 2 2z" />
      </g>
    </svg>
  );
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
    <div className="td-surface min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Nav bar */}
      <a
        href="https://tabledeck.us"
        className="absolute top-5 left-5 font-serif text-sm"
        style={{ color: "rgba(246,239,224,0.5)", fontVariant: "small-caps", letterSpacing: "0.15em" }}
      >
        ← Tabledeck
      </a>
      <div className="absolute top-5 right-5 flex gap-4 items-center">
        {user ? (
          <>
            <a
              href="/profile"
              className="font-sans text-sm"
              style={{ color: "rgba(246,239,224,0.7)" }}
            >
              {user.name || user.email}
            </a>
            <a
              href="/logout"
              className="font-sans text-sm"
              style={{ color: "rgba(246,239,224,0.45)" }}
            >
              Logout
            </a>
          </>
        ) : (
          <>
            <a
              href="/login"
              className="font-sans text-sm"
              style={{ color: "rgba(246,239,224,0.7)" }}
            >
              Login
            </a>
            <a
              href="/signup"
              className="font-sans text-sm font-medium"
              style={{ color: "#e8c872" }}
            >
              Sign Up
            </a>
          </>
        )}
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center mb-10">
        <KingsCrest size={88} />
        <h1
          className="font-serif mt-4"
          style={{
            fontWeight: 600,
            fontStyle: "italic",
            fontSize: 48,
            color: "#f6efe0",
            lineHeight: 1,
            letterSpacing: "0.01em",
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          King&rsquo;s Cribbage
        </h1>
        <p
          className="font-serif mt-2 text-center max-w-xs"
          style={{ fontVariant: "small-caps", letterSpacing: "0.22em", fontSize: 11, color: "rgba(201,162,74,0.8)" }}
        >
          Tabledeck &middot; First to 121
        </p>
        <p
          className="font-sans mt-3 text-center max-w-sm"
          style={{ fontSize: 15, color: "rgba(246,239,224,0.6)", lineHeight: 1.5 }}
        >
          The classic tile game — play cribbage hands on a board with friends.
          Share a link to play anywhere.
        </p>
      </div>

      {/* Create Game card */}
      <div className="td-lobby-card">
        <h2>New Game</h2>

        <label>Players</label>
        <div className="flex gap-2 mb-5">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`bid-chip ${playerCount === n ? "active" : ""}`}
            >
              {n}P
            </button>
          ))}
        </div>

        <BtnPrimary
          onClick={createGame}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create Game"}
        </BtnPrimary>

        <p
          className="text-center mt-3 font-sans"
          style={{ fontSize: 12, color: "var(--ink-faint)" }}
        >
          You&rsquo;ll get a shareable link to send to your friends
        </p>
      </div>

      {/* Rules link */}
      <div className="mt-8">
        <a
          href="https://www.cococogames.com/instructions.htm#english"
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif"
          style={{
            fontVariant: "small-caps",
            letterSpacing: "0.18em",
            fontSize: 12,
            color: "rgba(201,162,74,0.6)",
            textDecoration: "underline",
            textDecorationStyle: "dashed",
            textUnderlineOffset: "4px",
          }}
        >
          How to play King&rsquo;s Cribbage
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
